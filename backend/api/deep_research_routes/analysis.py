"""Analysis router stubs for Deep Research API."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter

from backend.models.deep_research_api import (
    AnalysisStartData,
    AnalysisStartRequest,
    AnalysisStatusData,
    ApiResponse,
)

from .utils import ok

router = APIRouter(prefix="/analysis", tags=["deep-research-analysis"])


@router.post("/start", response_model=ApiResponse[AnalysisStartData])
async def start_analysis(body: AnalysisStartRequest) -> ApiResponse[AnalysisStartData]:
    run_id = uuid.uuid4()
    if body.company_id:
        target = f"company_id={body.company_id}"
    else:
        target = f"orgnr={body.orgnr}"
    return ok(
        AnalysisStartData(
            run_id=run_id,
            status="queued",
            message=f"Analysis accepted for {target}",
            accepted_at=datetime.utcnow(),
        )
    )


@router.get("/runs/{run_id}", response_model=ApiResponse[AnalysisStatusData])
async def get_analysis_run(run_id: uuid.UUID) -> ApiResponse[AnalysisStatusData]:
    return ok(
        AnalysisStatusData(
            run_id=run_id,
            status="running",
            stage="source_collection",
            progress_pct=10,
        )
    )


@router.get("/runs", response_model=ApiResponse[list[AnalysisStatusData]])
async def list_analysis_runs() -> ApiResponse[list[AnalysisStatusData]]:
    return ok([])

