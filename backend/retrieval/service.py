"""End-to-end retrieval pipeline service."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.config import AppSettings, get_settings
from backend.db import SessionLocal

from .chunking import Chunker
from .content_extractor import ContentExtractor
from .embedding import EmbeddingService
from .query_planner import QueryPlanner
from .source_fetcher import SourceFetcher
from .source_storage import SourceStorage
from .types import RetrievalRequest, RetrievalResult
from .web_search import WebSearch

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RetrievalService:
    """Coordinates query planning, web search, fetching, extraction, and storage."""

    settings: AppSettings = field(default_factory=get_settings)
    planner: QueryPlanner = field(init=False)
    search: WebSearch = field(init=False)
    fetcher: SourceFetcher = field(init=False)
    extractor: ContentExtractor = field(init=False)
    chunker: Chunker = field(init=False)
    embedding: EmbeddingService = field(init=False)

    def __post_init__(self) -> None:
        self.planner = QueryPlanner(self.settings)
        self.search = WebSearch(self.settings)
        self.fetcher = SourceFetcher(self.settings)
        self.extractor = ContentExtractor()
        self.chunker = Chunker(self.settings)
        self.embedding = EmbeddingService(self.settings)

    def search_company_and_store(self, request: RetrievalRequest) -> RetrievalResult:
        queries = self.planner.plan(
            company_name=request.company_name,
            orgnr=request.orgnr,
            website=request.website,
            max_queries=request.max_queries or self.settings.retrieval_max_queries,
        )
        planned_queries = [q.query for q in queries]
        seen_urls: set[str] = set()
        warnings: list[str] = []
        fatal_errors: list[str] = []
        sources_stored = 0
        chunks_stored = 0
        skipped_urls = 0

        with SessionLocal() as session:
            storage = SourceStorage(session)
            company = storage.resolve_company(
                company_id=request.company_id,
                orgnr=request.orgnr,
                company_name=request.company_name,
                website=request.website,
            )
            run = storage.resolve_run(
                run_id=request.run_id,
                company_id=company.id,
                query=request.company_name,
            )
            try:
                for planned in queries:
                    results = self.search.search(
                        planned.query,
                        max_results=request.max_results_per_query
                        or self.settings.retrieval_max_results_per_query,
                    )
                    for result in results:
                        normalized_url = result.url.strip()
                        if not normalized_url:
                            continue
                        if normalized_url in seen_urls:
                            skipped_urls += 1
                            continue
                        seen_urls.add(normalized_url)

                        fetched = self.fetcher.fetch(normalized_url)
                        if not fetched.html:
                            storage.save_source(
                                run_id=run.id,
                                company_id=company.id,
                                source_type=result.provider,
                                title=result.title,
                                url=normalized_url,
                                content_text=None,
                                metadata={
                                    "query": planned.query,
                                    "query_reason": planned.reason,
                                    "provider": result.provider,
                                    "search_rank": result.rank,
                                    "snippet": result.snippet,
                                    "search_metadata": result.metadata,
                                    "fetch_error": fetched.error,
                                    "fetch_status_code": fetched.status_code,
                                },
                            )
                            sources_stored += 1
                            warnings.append(
                                f"fetch_failed:{normalized_url}:{fetched.error or fetched.status_code}"
                            )
                            continue
                        extracted = self.extractor.extract(fetched)
                        if extracted is None:
                            storage.save_source(
                                run_id=run.id,
                                company_id=company.id,
                                source_type=result.provider,
                                title=result.title,
                                url=fetched.final_url or normalized_url,
                                content_text=None,
                                metadata={
                                    "query": planned.query,
                                    "query_reason": planned.reason,
                                    "provider": result.provider,
                                    "search_rank": result.rank,
                                    "snippet": result.snippet,
                                    "search_metadata": result.metadata,
                                    "fetch_status_code": fetched.status_code,
                                    "extract_error": "empty_content",
                                },
                            )
                            sources_stored += 1
                            warnings.append(f"extract_failed:{normalized_url}")
                            continue

                        metadata = {
                            "query": planned.query,
                            "query_reason": planned.reason,
                            "provider": result.provider,
                            "search_rank": result.rank,
                            "snippet": result.snippet,
                            "search_metadata": result.metadata,
                            "extract_metadata": extracted.metadata,
                        }
                        source = storage.save_source(
                            run_id=run.id,
                            company_id=company.id,
                            source_type=result.provider,
                            title=extracted.title or result.title,
                            url=extracted.url,
                            content_text=extracted.text,
                            metadata=metadata,
                        )

                        chunks = self.chunker.split(extracted.text)
                        embed = self.embedding.embed_texts([c.text for c in chunks])
                        chunks_stored += storage.save_chunks(
                            source_id=source.id,
                            chunks=chunks,
                            embedding_model=embed.model if embed.model != "none" else None,
                        )
                        sources_stored += 1

                storage.complete_run(run.id, errors=fatal_errors)
                session.commit()
                return RetrievalResult(
                    run_id=run.id,
                    company_id=company.id,
                    provider=self.search.provider_name,
                    queries=planned_queries,
                    sources_stored=sources_stored,
                    chunks_stored=chunks_stored,
                    skipped_urls=skipped_urls,
                    errors=warnings,
                )
            except Exception as exc:
                logger.exception("Retrieval pipeline failed: %s", exc)
                fatal_errors.append(str(exc))
                storage.complete_run(run.id, errors=fatal_errors)
                session.commit()
                return RetrievalResult(
                    run_id=run.id,
                    company_id=company.id,
                    provider=self.search.provider_name,
                    queries=planned_queries,
                    sources_stored=sources_stored,
                    chunks_stored=chunks_stored,
                    skipped_urls=skipped_urls,
                    errors=warnings + fatal_errors,
                )

    def list_sources_for_run(self, run_id):
        with SessionLocal() as session:
            storage = SourceStorage(session)
            rows = storage.list_sources_for_run(run_id)
            return rows

    def health(self) -> dict:
        return {
            "provider": self.search.provider_name,
            "ready": True,
        }

