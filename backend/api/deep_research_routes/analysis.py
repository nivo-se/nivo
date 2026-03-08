"""Analysis router for Deep Research API — async job dispatch."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun
from backend.orchestrator import LangGraphAgentOrchestrator
from backend.orchestrator.persistence import RunStateRepository

from backend.models.deep_research_api import (
    AnalysisStartData,
    AnalysisStartRequest,
    AnalysisStatusData,
    ApiResponse,
    RunStageData,
)

from .utils import ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["deep-research-analysis"])
orchestrator = LangGraphAgentOrchestrator()


def _enqueue_pipeline(run_id: uuid.UUID, body: AnalysisStartRequest) -> None:
    """Enqueue a full pipeline job on the deep_research RQ queue."""
    try:
        from rq import Queue
        from backend.common.redis_client import RedisClientManager

        redis_conn = RedisClientManager.get_connection()
        queue = Queue("deep_research", connection=redis_conn)
        from backend.orchestrator.worker import run_pipeline_job

        queue.enqueue(
            run_pipeline_job,
            kwargs={
                "run_id": str(run_id),
                "company_name": body.company_name,
                "orgnr": body.orgnr,
                "company_id": str(body.company_id) if body.company_id else None,
                "website": body.website,
                "query": body.query,
            },
            job_timeout="30m",
        )
    except Exception:
        logger.exception("Failed to enqueue pipeline job for run %s — running inline", run_id)
        orchestrator.execute_basic_run(
            run_id=run_id,
            company_name=body.company_name,
            orgnr=body.orgnr,
            company_id=body.company_id,
            website=body.website,
            query=body.query,
        )


@router.post("/start", response_model=ApiResponse[AnalysisStartData])
async def start_analysis(body: AnalysisStartRequest) -> ApiResponse[AnalysisStartData]:
    with SessionLocal() as session:
        repo = RunStateRepository(session)
        company = repo.resolve_company(
            company_id=body.company_id,
            orgnr=body.orgnr,
            company_name=body.company_name or (f"Company {body.orgnr}" if body.orgnr else None),
            website=body.website,
        )
        run = repo.create_or_resume_run(
            run_id=body.run_id,
            company_id=company.id,
            query=body.query or company.name,
            initial_status="pending",
        )
        session.commit()
        run_id = run.id

    _enqueue_pipeline(run_id, body)

    return ok(
        AnalysisStartData(
            run_id=run_id,
            status="pending",
            message="Analysis job queued",
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
            company_id=status.get("company_id"),
            status=status["status"],
            current_stage=status["current_stage"],
            stages=[
                RunStageData(
                    stage=s["stage"],
                    status=s["status"],
                    started_at=s.get("started_at"),
                    finished_at=s.get("finished_at"),
                )
                for s in status.get("stages", [])
            ],
        )
    )


@router.get("/runs", response_model=ApiResponse[list[AnalysisStatusData]])
async def list_analysis_runs() -> ApiResponse[list[AnalysisStatusData]]:
    runs = orchestrator.list_runs(limit=20)
    return ok(
        [
            AnalysisStatusData(
                run_id=r["run_id"],
                company_id=r.get("company_id"),
                status=r["status"],
                current_stage=r["current_stage"],
                stages=[
                    RunStageData(
                        stage=s["stage"],
                        status=s["status"],
                        started_at=s.get("started_at"),
                        finished_at=s.get("finished_at"),
                    )
                    for s in r.get("stages", [])
                ],
            )
            for r in runs
        ]
    )

