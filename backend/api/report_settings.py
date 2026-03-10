"""
Report retrieval settings: admin-set limits for Deep Research web retrieval.
Stored in public.report_retrieval_config; visible and editable in Admin Report settings.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from backend.db import SessionLocal
from .dependencies import get_current_user_id
from .rbac import require_role

router = APIRouter(prefix="/api/admin/report-settings", tags=["admin", "report-settings"])

DEFAULTS = {
    "max_queries_per_stage": 10,
    "max_results_per_query": 8,
    "max_extracted_urls": 15,
    "max_per_domain": 3,
}

# Bounded retrieval loop (BOUNDED_RETRIEVAL_LOOP_SPEC)
RETRIEVAL_LOOP_DEFAULTS = {
    "max_primary_rounds": 1,
    "max_supplemental_rounds": 2,
    "max_queries_per_stage": 6,
    "max_extracted_urls_per_stage": 10,
    "market_evidence_quality_threshold": 0.70,
    "competitor_evidence_quality_threshold": 0.65,
    "degrade_if_budget_exceeded": True,
    "stop_if_threshold_met": True,
}


class ReportRetrievalConfigResponse(BaseModel):
    max_queries_per_stage: int
    max_results_per_query: int
    max_extracted_urls: int
    max_per_domain: int
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class ReportRetrievalConfigUpdate(BaseModel):
    max_queries_per_stage: Optional[int] = Field(default=None, ge=4, le=20)
    max_results_per_query: Optional[int] = Field(default=None, ge=1, le=20)
    max_extracted_urls: Optional[int] = Field(default=None, ge=8, le=30)
    max_per_domain: Optional[int] = Field(default=None, ge=1, le=5)


def _get_config_from_db() -> ReportRetrievalConfigResponse | None:
    """Fetch config from DB. Returns None if table doesn't exist or is empty."""
    try:
        with SessionLocal() as session:
            row = session.execute(
                text(
                    "SELECT max_queries_per_stage, max_results_per_query, max_extracted_urls, "
                    "max_per_domain, updated_at, updated_by "
                    "FROM public.report_retrieval_config WHERE id = 1"
                )
            ).fetchone()
            if row is None:
                return None
            return ReportRetrievalConfigResponse(
                max_queries_per_stage=row[0],
                max_results_per_query=row[1],
                max_extracted_urls=row[2],
                max_per_domain=row[3],
                updated_at=row[4].isoformat() if row[4] else None,
                updated_by=row[5],
            )
    except Exception:
        return None


def _update_config_in_db(
    updates: ReportRetrievalConfigUpdate,
    updated_by: str | None,
) -> ReportRetrievalConfigResponse:
    """Update config in DB. Uses defaults for missing columns."""
    with SessionLocal() as session:
        session.execute(
            text(
                """
                INSERT INTO public.report_retrieval_config (
                    id, max_queries_per_stage, max_results_per_query,
                    max_extracted_urls, max_per_domain, updated_at, updated_by
                )
                VALUES (
                    1,
                    COALESCE(:max_queries_per_stage, 10),
                    COALESCE(:max_results_per_query, 8),
                    COALESCE(:max_extracted_urls, 15),
                    COALESCE(:max_per_domain, 3),
                    NOW(),
                    :updated_by
                )
                ON CONFLICT (id) DO UPDATE SET
                    max_queries_per_stage = COALESCE(:max_queries_per_stage, report_retrieval_config.max_queries_per_stage),
                    max_results_per_query = COALESCE(:max_results_per_query, report_retrieval_config.max_results_per_query),
                    max_extracted_urls = COALESCE(:max_extracted_urls, report_retrieval_config.max_extracted_urls),
                    max_per_domain = COALESCE(:max_per_domain, report_retrieval_config.max_per_domain),
                    updated_at = NOW(),
                    updated_by = COALESCE(:updated_by, report_retrieval_config.updated_by)
                """
            ),
            {
                "max_queries_per_stage": updates.max_queries_per_stage,
                "max_results_per_query": updates.max_results_per_query,
                "max_extracted_urls": updates.max_extracted_urls,
                "max_per_domain": updates.max_per_domain,
                "updated_by": updated_by,
            },
        )
        session.commit()
    return _get_config_from_db() or ReportRetrievalConfigResponse(
        max_queries_per_stage=DEFAULTS["max_queries_per_stage"],
        max_results_per_query=DEFAULTS["max_results_per_query"],
        max_extracted_urls=DEFAULTS["max_extracted_urls"],
        max_per_domain=DEFAULTS["max_per_domain"],
        updated_at=None,
        updated_by=updated_by,
    )


@router.get("", response_model=ReportRetrievalConfigResponse)
async def get_report_settings(_: str = Depends(require_role("admin"))):
    """Get current report retrieval limits (admin only). Falls back to defaults when no DB config."""
    config = _get_config_from_db()
    if config is not None:
        return config
    return ReportRetrievalConfigResponse(
        max_queries_per_stage=DEFAULTS["max_queries_per_stage"],
        max_results_per_query=DEFAULTS["max_results_per_query"],
        max_extracted_urls=DEFAULTS["max_extracted_urls"],
        max_per_domain=DEFAULTS["max_per_domain"],
        updated_at=None,
        updated_by=None,
    )


@router.put("", response_model=ReportRetrievalConfigResponse)
async def update_report_settings(
    body: ReportRetrievalConfigUpdate,
    request: Request,
    user_id: str = Depends(require_role("admin")),
):
    """Update report retrieval limits (admin only)."""
    return _update_config_in_db(body, updated_by=user_id)


def get_report_retrieval_config() -> dict:
    """
    Return current retrieval config for use by web_retrieval_service.
    Reads from DB; falls back to defaults if table missing or empty.
    """
    config = _get_config_from_db()
    if config is not None:
        return {
            "max_queries_per_stage": config.max_queries_per_stage,
            "max_results_per_query": config.max_results_per_query,
            "max_extracted_urls": config.max_extracted_urls,
            "max_per_domain": config.max_per_domain,
        }
    return DEFAULTS.copy()


def get_retrieval_loop_config() -> dict:
    """
    Return bounded retrieval loop config (BOUNDED_RETRIEVAL_LOOP_SPEC).
    Hard limits to prevent unbounded research loops.
    """
    return RETRIEVAL_LOOP_DEFAULTS.copy()
