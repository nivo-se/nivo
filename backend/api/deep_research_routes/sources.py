"""Sources router stubs for Deep Research API."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun
from backend.models.deep_research_api import (
    ApiResponse,
    SearchCompanySourcesData,
    SearchCompanySourcesRequest,
    SourceCreateRequest,
    SourceData,
    SourceListData,
    UserSourceInput,
)
from backend.retrieval import RetrievalRequest, RetrievalService
from backend.retrieval.chunking import Chunker
from backend.retrieval.source_storage import SourceStorage
from backend.services.web_intel.tavily_client import TavilyClient

from .utils import ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["deep-research-sources"])


def _fetch_url_content(url: str) -> str | None:
    """Fetch content from URL via Tavily Extract. Returns None if fetch fails."""
    client = TavilyClient()
    if not client.api_key:
        logger.warning("Tavily not configured; cannot fetch URL content")
        return None
    results = client.extract([url])
    for r in results:
        if r.url == url and not r.failed and r.raw_content:
            return r.raw_content
    return None


def ingest_user_sources(
    session: Session,
    *,
    run_id: uuid.UUID,
    company_id: uuid.UUID,
    sources: list[UserSourceInput],
) -> int:
    """
    Ingest user-provided sources for a run. Fetches URL content when url-only.
    Returns count of sources ingested.
    """
    settings = get_settings()
    storage = SourceStorage(session)
    chunker = Chunker(settings)
    count = 0
    for src in sources:
        content_text: str | None = None
        url = src.url
        title = src.title or (url or "Manual source")

        if src.raw_text:
            content_text = src.raw_text.strip()
        elif src.source_type == "url" and url:
            content_text = _fetch_url_content(url)  # None if fetch fails; store URL-only

        source = storage.save_source(
            run_id=run_id,
            company_id=company_id,
            source_type=src.source_type,
            title=title,
            url=url,
            content_text=content_text or None,
            metadata={"manual_ingest": True},
        )
        if content_text and len(content_text.strip()) >= 30:
            chunks = chunker.split(content_text)
            storage.save_chunks(
                source_id=source.id,
                chunks=chunks,
                embedding_model=None,
            )
        count += 1
    return count


@router.post("/search-company", response_model=ApiResponse[SearchCompanySourcesData])
async def search_company_sources(
    body: SearchCompanySourcesRequest,
) -> ApiResponse[SearchCompanySourcesData]:
    service = RetrievalService()
    result = service.search_company_and_store(
        RetrievalRequest(
            company_name=body.company_name,
            orgnr=body.orgnr,
            company_id=body.company_id,
            website=body.website,
            run_id=body.run_id,
            max_results_per_query=body.max_results_per_query,
            max_queries=body.max_queries,
        )
    )
    return ok(
        SearchCompanySourcesData(
            run_id=result.run_id,
            company_id=result.company_id,
            provider=result.provider,
            queries=result.queries,
            sources_stored=result.sources_stored,
            chunks_stored=result.chunks_stored,
            skipped_urls=result.skipped_urls,
            warnings=result.errors,
        )
    )


@router.post("/ingest", response_model=ApiResponse[SourceData])
async def ingest_source(body: SourceCreateRequest) -> ApiResponse[SourceData]:
    settings = get_settings()
    with SessionLocal() as session:
        run = session.get(AnalysisRun, body.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="analysis run not found")
        storage = SourceStorage(session)
        source = storage.save_source(
            run_id=body.run_id,
            company_id=run.company_id,
            source_type=body.source_type,
            title=body.url or "Manual source",
            url=body.url,
            content_text=body.raw_text,
            metadata={"manual_ingest": True},
        )
        chunk_count = 0
        status = "accepted"
        if body.raw_text:
            chunker = Chunker(settings)
            chunks = chunker.split(body.raw_text)
            chunk_count = storage.save_chunks(
                source_id=source.id,
                chunks=chunks,
                embedding_model=None,
            )
            status = "ingested"
        session.commit()
        return ok(
            SourceData(
                source_id=source.id,
                run_id=body.run_id,
                source_type=body.source_type,
                status=status,
                title=source.title,
                url=source.url,
                chunk_count=chunk_count,
            )
        )


@router.get("/runs/{run_id}", response_model=ApiResponse[SourceListData])
async def list_sources_for_run(run_id: uuid.UUID) -> ApiResponse[SourceListData]:
    with SessionLocal() as session:
        storage = SourceStorage(session)
        rows = storage.list_sources_for_run(run_id)
        source_ids = [row.id for row in rows]
        chunk_map = storage.chunk_counts_for_source_ids(source_ids)
        items = [
            SourceData(
                source_id=row.id,
                run_id=row.run_id,
                source_type=row.source_type,
                status="ingested" if chunk_map.get(row.id, 0) > 0 else "accepted",
                title=row.title,
                url=row.url,
                chunk_count=chunk_map.get(row.id, 0),
            )
            for row in rows
        ]
        return ok(SourceListData(run_id=run_id, items=items))

