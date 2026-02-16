"""
AI Report generation endpoints.

Canonical path: cache-first from Postgres company_enrichment, else generate + persist.
POST /generate and GET /companies/{orgnr}/ai-report share the same implementation.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent))

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-reports", tags=["ai-reports"])


class GenerateReportRequest(BaseModel):
    """Request to generate AI report"""
    orgnr: str
    force_regenerate: bool = False
    force_regen: bool = False  # alias for compatibility


def _get_force_regen(body: GenerateReportRequest) -> bool:
    """Support force_regenerate and force_regen."""
    return body.force_regenerate or body.force_regen


@router.post("/generate")
async def generate_report(request: GenerateReportRequest):
    """
    Generate AI report (canonical entrypoint).

    Cache-first: if company_enrichment has ai_report or composable llm_analysis, return it.
    Otherwise: generate via LLM, persist to company_enrichment kind=ai_report, return.
    Use force_regenerate=true or force_regen=true to bypass cache.
    """
    orgnr = request.orgnr.strip()
    force_regen = _get_force_regen(request)

    db = get_database_service()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    from ..services import ai_report_service

    # 1) Try cache (unless force_regen)
    if not force_regen:
        report = ai_report_service.build_ai_report_from_db(orgnr, db)
        if report is not None:
            return {**report, "cached": True}

    # 2) Generate via LLM and persist
    try:
        from ..llm.provider_factory import get_llm_provider
        provider = get_llm_provider()
    except Exception as e:
        logger.warning("LLM provider not available: %s", e)
        raise HTTPException(
            status_code=503,
            detail="LLM provider not configured (set LLM_BASE_URL/OPENAI_API_KEY)",
        ) from e

    run_id = None
    try:
        run_id = db.create_enrichment_run(
            source="ai-report-generate",
            provider="openai_compat",
            model=provider.model if hasattr(provider, "model") else None,
            prompt_version="v1",
        )
    except Exception as run_exc:
        logger.debug("create_enrichment_run failed (tables may not exist): %s", run_exc)

    report = ai_report_service.generate_ai_report(orgnr, provider, db=db)

    if run_id:
        ai_report_service.persist_ai_report(db, orgnr, report, run_id, meta={"source": "generate"})

    return {**report, "cached": False}


@router.post("/generate-batch")
async def generate_reports_batch(orgnrs: list[str]):
    """
    Generate AI reports for multiple companies.
    Uses same cache-first logic per company.
    """
    db = get_database_service()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from ..llm.provider_factory import get_llm_provider
        provider = get_llm_provider()
    except Exception as e:
        logger.warning("LLM provider not available for generate-batch: %s", e)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable") from e

    from ..services import ai_report_service

    results = []
    for orgnr in orgnrs[:50]:  # cap batch size
        orgnr = str(orgnr).strip()
        report = ai_report_service.build_ai_report_from_db(orgnr, db)
        cached = report is not None
        if not cached:
            try:
                run_id = db.create_enrichment_run(source="ai-report-generate", provider="openai_compat", prompt_version="v1")
                report = ai_report_service.generate_ai_report(orgnr, provider, db=db)
                if run_id:
                    ai_report_service.persist_ai_report(db, orgnr, report, run_id)
            except Exception as exc:
                logger.warning("Failed to generate report for %s: %s", orgnr, exc)
                continue
        if report:
            results.append({**report, "cached": cached})

    return {"count": len(results), "reports": results}
