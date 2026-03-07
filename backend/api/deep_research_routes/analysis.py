"""Analysis router stubs for Deep Research API."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from backend.orchestrator import LangGraphAgentOrchestrator

from backend.models.deep_research_api import (
    AnalysisStartData,
    AnalysisStartRequest,
    AnalysisStatusData,
    ApiResponse,
)

from .utils import ok

router = APIRouter(prefix="/analysis", tags=["deep-research-analysis"])
orchestrator = LangGraphAgentOrchestrator()


@router.post("/start", response_model=ApiResponse[AnalysisStartData])
async def start_analysis(body: AnalysisStartRequest) -> ApiResponse[AnalysisStartData]:
    result = orchestrator.execute_basic_run(
        company_name=body.company_name,
        orgnr=body.orgnr,
        company_id=body.company_id,
        website=body.website,
        query=body.query,
        run_id=body.run_id,
    )
    return ok(
        AnalysisStartData(
            run_id=result.run_id,
            status=result.status,
            message=f"Basic pipeline executed ({result.stage})",
            accepted_at=datetime.utcnow(),
        )
    )


@router.get("/runs/{run_id}", response_model=ApiResponse[AnalysisStatusData])
async def get_analysis_run(run_id: uuid.UUID) -> ApiResponse[AnalysisStatusData]:
    status = orchestrator.get_run_status(run_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return ok(
        AnalysisStatusData(
            run_id=run_id,
            status=status["status"],
            stage=status["stage"],
            progress_pct=status["progress_pct"],
        )
    )


@router.get("/runs", response_model=ApiResponse[list[AnalysisStatusData]])
async def list_analysis_runs() -> ApiResponse[list[AnalysisStatusData]]:
    runs = orchestrator.list_runs(limit=20)
    return ok(
        [
            AnalysisStatusData(
                run_id=r["run_id"],
                status=r["status"],
                stage=r["stage"],
                progress_pct=r["progress_pct"],
            )
            for r in runs
        ]
    )

