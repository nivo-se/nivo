"""Sources router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from backend.models.deep_research_api import (
    ApiResponse,
    SourceCreateRequest,
    SourceData,
    SourceListData,
)

from .utils import ok

router = APIRouter(prefix="/sources", tags=["deep-research-sources"])


@router.post("/ingest", response_model=ApiResponse[SourceData])
async def ingest_source(body: SourceCreateRequest) -> ApiResponse[SourceData]:
    return ok(
        SourceData(
            source_id=uuid.uuid4(),
            run_id=body.run_id,
            source_type=body.source_type,
            status="accepted",
        )
    )


@router.get("/runs/{run_id}", response_model=ApiResponse[SourceListData])
async def list_sources_for_run(run_id: uuid.UUID) -> ApiResponse[SourceListData]:
    return ok(SourceListData(run_id=run_id, items=[]))

