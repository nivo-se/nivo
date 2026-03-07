"""Sources router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

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
)
from backend.retrieval import RetrievalRequest, RetrievalService
from backend.retrieval.chunking import Chunker
from backend.retrieval.source_storage import SourceStorage

from .utils import ok

router = APIRouter(prefix="/sources", tags=["deep-research-sources"])


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

