"""Analysis router for Deep Research API — async job dispatch."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Company, RunNodeState
from backend.orchestrator import LangGraphAgentOrchestrator
from backend.orchestrator.persistence import RunStateRepository

from backend.models.deep_research_api import (
    AnalysisStartData,
    AnalysisStartRequest,
    AnalysisStatusData,
    ApiResponse,
    RunDiagnosticsData,
    RunStageData,
)

from .sources import ingest_user_sources
from .utils import ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["deep-research-analysis"])
orchestrator = LangGraphAgentOrchestrator()


def _enqueue_pipeline(run_id: uuid.UUID, company_id: uuid.UUID, body: AnalysisStartRequest) -> None:
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
                "company_id": str(company_id),
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
            company_id=company_id,
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
        resolved_company_id = company.id

    if body.sources:
        with SessionLocal() as ingest_session:
            ingest_user_sources(
                ingest_session,
                run_id=run_id,
                company_id=resolved_company_id,
                sources=body.sources,
            )
            ingest_session.commit()

    _enqueue_pipeline(run_id, resolved_company_id, body)

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
            company_name=status.get("company_name"),
            orgnr=status.get("orgnr"),
            created_at=status.get("created_at"),
            status=status["status"],
            current_stage=status["current_stage"],
            stages=[
                RunStageData(
                    stage=s["stage"],
                    status=s["status"],
                    started_at=s.get("started_at"),
                    finished_at=s.get("finished_at"),
                    error_message=s.get("error_message"),
                    output=s.get("output"),
                )
                for s in status.get("stages", [])
            ],
            error_message=status.get("error_message"),
            diagnostics=status.get("diagnostics"),
            report_quality_status=status.get("report_quality_status"),
            quick_check_suggestion=status.get("quick_check_suggestion"),
            suggested_action=status.get("suggested_action"),
        )
    )


def _run_to_analysis_status(r: dict) -> AnalysisStatusData:
    """Map list_runs entry to AnalysisStatusData, including pilot diagnostics when available."""
    diag = r.get("diagnostics")
    return AnalysisStatusData(
        run_id=r["run_id"],
        company_id=r.get("company_id"),
        company_name=r.get("company_name"),
        orgnr=r.get("orgnr"),
        created_at=r.get("created_at"),
        status=r["status"],
        current_stage=r["current_stage"],
        stages=[
            RunStageData(
                stage=s["stage"],
                status=s["status"],
                started_at=s.get("started_at"),
                finished_at=s.get("finished_at"),
                error_message=s.get("error_message"),
            )
            for s in r.get("stages", [])
        ],
        error_message=r.get("error_message"),
        diagnostics=RunDiagnosticsData.model_validate(diag) if diag and isinstance(diag, dict) else None,
        report_quality_status=r.get("report_quality_status") or (diag.get("report_quality_status") if isinstance(diag, dict) else None),
        quick_check_suggestion=r.get("quick_check_suggestion"),
        suggested_action=r.get("suggested_action"),
    )


@router.get("/runs", response_model=ApiResponse[list[AnalysisStatusData]])
async def list_analysis_runs() -> ApiResponse[list[AnalysisStatusData]]:
    runs = orchestrator.list_runs(limit=20)
    return ok([_run_to_analysis_status(r) for r in runs])


@router.post("/runs/{run_id}/restart", response_model=ApiResponse[AnalysisStartData])
async def restart_run(
    run_id: uuid.UUID,
    force: bool = False,
    website: str | None = None,
) -> ApiResponse[AnalysisStartData]:
    """Re-enqueue a pending or failed run. Use when the job was lost (e.g. Redis restarted) or stuck.
    Set force=true to reset a run stuck in 'running' (e.g. worker crashed).
    Pass website= to add/update company website before restart (e.g. after quick check failure)."""
    with SessionLocal() as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        if run.status == "running" and not force:
            raise HTTPException(
                status_code=400,
                detail="Cannot restart a run that is currently running. Use force=true to reset a stuck run.",
            )
        if run.status == "completed":
            raise HTTPException(
                status_code=400,
                detail="Run already completed. Start a new analysis instead.",
            )
        company = session.get(Company, run.company_id) if run.company_id else None
        if not company:
            raise HTTPException(status_code=400, detail="Run has no company")

        if website and website.strip():
            company.website = website.strip()
            session.flush()

        repo = RunStateRepository(session)
        repo.clear_run_analysis_data(run_id)

        run.status = "pending"
        run.started_at = None
        run.completed_at = None
        run.error_message = None
        if run.extra and isinstance(run.extra, dict):
            extra = {k: v for k, v in run.extra.items() if k not in ("quick_check_suggestion", "quick_check_queries_tried")}
            run.extra = extra
        session.commit()

        body = AnalysisStartRequest(
            company_id=str(run.company_id),
            orgnr=company.orgnr,
            company_name=company.name,
            website=company.website,
            query=run.query or company.name,
        )
        _enqueue_pipeline(run_id, run.company_id, body)

    return ok(
        AnalysisStartData(
            run_id=run_id,
            status="pending",
            message="Run re-queued",
            accepted_at=datetime.utcnow(),
        )
    )


@router.get("/runs/{run_id}/debug", response_model=ApiResponse[dict])
async def get_run_debug(run_id: uuid.UUID) -> ApiResponse[dict]:
    """Expose debug artifact and run diagnostics for developer/analyst inspection."""
    with SessionLocal() as session:
        run = session.get(AnalysisRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
        row = session.execute(
            select(RunNodeState).where(
                RunNodeState.run_id == run_id,
                RunNodeState.node_name == "analysis_input_debug",
            )
        ).scalar_one_or_none()
        debug_data = (row.output_json if isinstance(row.output_json, dict) else {}) if row else {}
        run_extra = run.extra if isinstance(run.extra, dict) else {}
        run_diagnostics = run_extra.get("run_diagnostics")
        if run_diagnostics is not None:
            debug_data = {**debug_data, "run_diagnostics": run_diagnostics}
        # Always return something for existing run (helps admin/debug)
        if not debug_data:
            debug_data = {
                "run_id": str(run_id),
                "status": run.status,
                "error_message": run.error_message,
                "message": "No debug artifact yet (run may not have reached report_generation)",
            }
        return ok(debug_data)


def _build_validation_summary(run: AnalysisRun) -> dict:
    """Build compact release-validation summary from run diagnostics."""
    extra = run.extra if isinstance(run.extra, dict) else {}
    diag = extra.get("run_diagnostics") or {}
    return {
        "run_id": str(run.id),
        "status": run.status,
        "error_message": run.error_message,
        "report_quality_status": diag.get("report_quality_status"),
        "report_quality_reason_codes": diag.get("report_quality_reason_codes") or [],
        "report_quality_limitation_summary": diag.get("report_quality_limitation_summary") or [],
        "assumption_valuation_ready": diag.get("assumption_valuation_ready"),
        "assumption_blocked_reasons": diag.get("assumption_blocked_reasons") or [],
        "valuation_skipped": diag.get("valuation_skipped", False),
        "valuation_readiness": diag.get("valuation_readiness"),
        "report_degraded": diag.get("report_degraded", False),
        "report_degraded_reasons": extra.get("report_degraded_reasons") or diag.get("report_degraded_reasons") or [],
        "evidence_accepted_count": diag.get("evidence_accepted_count"),
        "evidence_rejected_count": diag.get("evidence_rejected_count"),
        "failure_reason_codes": diag.get("failure_reason_codes") or [],
        "stage_durations": diag.get("stage_durations") or {},
    }


@router.get("/runs/{run_id}/validation-summary", response_model=ApiResponse[dict])
async def get_run_validation_summary(run_id: uuid.UUID) -> ApiResponse[dict]:
    """Compact release-validation summary: diagnostics, quality status, readiness flags.
    Useful for admin, scripts, and release-validation pass."""
    with SessionLocal() as session:
        run = session.get(AnalysisRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
        return ok(_build_validation_summary(run))

