"""Recompute router for Deep Research API — dispatches partial pipeline reruns."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException

from backend.db import SessionLocal
from backend.db.models.deep_research import ReportVersion
from backend.orchestrator.persistence import RunStateRepository

from backend.models.deep_research_api import (
    ApiResponse,
    RecomputeData,
    RecomputeReportRequest,
    RecomputeSectionRequest,
)

from .utils import ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recompute", tags=["deep-research-recompute"])

SECTION_TO_START_NODE: dict[str, str] = {
    "executive_summary": "report_generation",
    "company_identity_and_profile": "identity",
    "company": "identity",
    "company_profile": "company_profile",
    "market_and_competitive_landscape": "market_analysis",
    "market": "market_analysis",
    "market_analysis": "market_analysis",
    "competitors": "competitor_discovery",
    "competitor_discovery": "competitor_discovery",
    "strategy_and_value_creation": "strategy",
    "strategy": "strategy",
    "value_creation": "value_creation",
    "financials_and_valuation": "financial_model",
    "financial_model": "financial_model",
    "valuation": "valuation",
    "verification": "verification",
}


def _enqueue_partial(run_id: uuid.UUID, start_from_node: str, instructions: str | None = None) -> None:
    """Enqueue a partial pipeline job on the deep_research RQ queue."""
    try:
        from rq import Queue
        from backend.common.redis_client import RedisClientManager

        redis_conn = RedisClientManager.get_connection()
        queue = Queue("deep_research", connection=redis_conn)
        from backend.orchestrator.worker import run_partial_pipeline_job

        queue.enqueue(
            run_partial_pipeline_job,
            kwargs={
                "run_id": str(run_id),
                "start_from_node": start_from_node,
                "instructions": instructions,
            },
            job_timeout="30m",
        )
    except Exception:
        logger.exception("Failed to enqueue partial job for run %s — running inline", run_id)
        from backend.orchestrator import LangGraphAgentOrchestrator
        orchestrator = LangGraphAgentOrchestrator()
        orchestrator.execute_partial_run(run_id=run_id, start_from_node=start_from_node, instructions=instructions)


def _lookup_report_version(report_version_id: uuid.UUID) -> ReportVersion:
    with SessionLocal() as session:
        rv = session.get(ReportVersion, report_version_id)
        if rv is None:
            raise HTTPException(status_code=404, detail="Report version not found")
        session.expunge(rv)
        return rv


def _create_recompute_run(
    company_id: uuid.UUID,
    query: str,
    source_run_id: uuid.UUID,
    start_from_node: str,
) -> uuid.UUID:
    from backend.orchestrator.langgraph_orchestrator import PIPELINE_NODES

    with SessionLocal() as session:
        repo = RunStateRepository(session)
        run = repo.create_or_resume_run(
            run_id=None,
            company_id=company_id,
            query=query,
            initial_status="pending",
        )

        start_idx = PIPELINE_NODES.index(start_from_node) if start_from_node in PIPELINE_NODES else 0
        source_nodes = repo.list_node_states(source_run_id)
        for node in source_nodes:
            if node.node_name in PIPELINE_NODES:
                idx = PIPELINE_NODES.index(node.node_name)
                if idx < start_idx and node.status == "completed":
                    repo.upsert_node_state(
                        run_id=run.id,
                        node_name=node.node_name,
                        status="completed",
                        input_json=node.input_json if isinstance(node.input_json, dict) else {},
                        output_json=node.output_json if isinstance(node.output_json, dict) else {},
                        error_message=None,
                    )

        session.commit()
        return run.id


def _validate_recompute_readiness(run_id: uuid.UUID, start_from_node: str) -> None:
    """Check that upstream data exists before allowing recompute. Raises HTTPException if not ready."""
    from backend.orchestrator.langgraph_orchestrator import PIPELINE_NODES

    start_idx = PIPELINE_NODES.index(start_from_node) if start_from_node in PIPELINE_NODES else 0
    if start_idx == 0:
        return

    with SessionLocal() as session:
        repo = RunStateRepository(session)
        nodes = repo.list_node_states(run_id)
        completed_names = {n.node_name for n in nodes if n.status == "completed"}

        for i in range(start_idx):
            if PIPELINE_NODES[i] not in completed_names:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot recompute from {start_from_node}: upstream stage '{PIPELINE_NODES[i]}' is not completed",
                )


@router.post("/report", response_model=ApiResponse[RecomputeData])
async def recompute_report(body: RecomputeReportRequest) -> ApiResponse[RecomputeData]:
    rv = _lookup_report_version(body.report_version_id)
    _validate_recompute_readiness(rv.run_id, "report_generation")
    new_run_id = _create_recompute_run(
        company_id=rv.company_id,
        query=f"recompute report v{rv.version_number}",
        source_run_id=rv.run_id,
        start_from_node="report_generation",
    )
    _enqueue_partial(new_run_id, start_from_node="report_generation")
    return ok(
        RecomputeData(
            job_id=new_run_id,
            report_version_id=body.report_version_id,
            status="queued",
        )
    )


@router.post("/section", response_model=ApiResponse[RecomputeData])
async def recompute_section(body: RecomputeSectionRequest) -> ApiResponse[RecomputeData]:
    start_node = SECTION_TO_START_NODE.get(body.section_key)
    if start_node is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown section_key: {body.section_key}. "
            f"Valid keys: {', '.join(sorted(SECTION_TO_START_NODE))}",
        )
    rv = _lookup_report_version(body.report_version_id)
    _validate_recompute_readiness(rv.run_id, start_node)
    new_run_id = _create_recompute_run(
        company_id=rv.company_id,
        query=f"recompute section {body.section_key}",
        source_run_id=rv.run_id,
        start_from_node=start_node,
    )
    _enqueue_partial(new_run_id, start_from_node=start_node, instructions=body.instructions)
    return ok(
        RecomputeData(
            job_id=new_run_id,
            report_version_id=body.report_version_id,
            status="queued",
        )
    )

