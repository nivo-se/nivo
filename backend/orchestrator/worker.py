"""Deep Research RQ worker — executes LangGraph pipeline jobs."""

from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


def run_pipeline_job(
    *,
    run_id: str,
    company_name: str | None = None,
    orgnr: str | None = None,
    company_id: str | None = None,
    website: str | None = None,
    query: str | None = None,
) -> dict:
    """RQ job function: execute the full LangGraph pipeline for a given run."""
    from backend.orchestrator import LangGraphAgentOrchestrator

    logger.info("Worker starting pipeline for run_id=%s", run_id)
    orchestrator = LangGraphAgentOrchestrator()
    result = orchestrator.execute_basic_run(
        run_id=uuid.UUID(run_id),
        company_name=company_name,
        orgnr=orgnr,
        company_id=uuid.UUID(company_id) if company_id else None,
        website=website,
        query=query,
    )
    logger.info(
        "Worker finished run_id=%s status=%s stage=%s",
        run_id, result.status, result.stage,
    )
    return {"run_id": str(result.run_id), "status": result.status}


def run_partial_pipeline_job(
    *,
    run_id: str,
    start_from_node: str,
    instructions: str | None = None,
) -> dict:
    """RQ job function: execute a partial pipeline recompute starting from a specific node."""
    from backend.orchestrator import LangGraphAgentOrchestrator

    logger.info("Worker starting partial pipeline for run_id=%s from node=%s", run_id, start_from_node)
    orchestrator = LangGraphAgentOrchestrator()
    result = orchestrator.execute_partial_run(
        run_id=uuid.UUID(run_id),
        start_from_node=start_from_node,
        instructions=instructions,
    )
    logger.info(
        "Worker finished partial run_id=%s status=%s",
        run_id, result.status,
    )
    return {"run_id": str(result.run_id), "status": result.status}
