"""
Read-only API for the fixed GPT website-research + Layer2 triage universe.

Run id comes from env GPT_TARGET_UNIVERSE_RUN_ID (single cohort; no run picker).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gpt-target-universe", tags=["gpt-target-universe"])

MAX_ROWS = 2000


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"
    raise HTTPException(401, "Authentication required")


def _require_postgres() -> None:
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "DATABASE_SOURCE must be postgres for GPT target universe")


def _configured_run_id() -> UUID:
    raw = (os.getenv("GPT_TARGET_UNIVERSE_RUN_ID") or "").strip()
    if not raw:
        raise HTTPException(
            503,
            "GPT_TARGET_UNIVERSE_RUN_ID is not set — configure the target screening run UUID in the backend environment.",
        )
    try:
        return UUID(raw)
    except ValueError as e:
        raise HTTPException(503, f"GPT_TARGET_UNIVERSE_RUN_ID is not a valid UUID: {raw}") from e


class GptTargetCompanyRow(BaseModel):
    orgnr: str
    company_name: Optional[str] = None
    rank: Optional[int] = None
    gpt_official_website_url: Optional[str] = None
    about_fetch_status: Optional[str] = None
    llm_triage_at: Optional[str] = None
    is_fit_for_nivo: Optional[bool] = None
    fit_confidence: Optional[float] = None
    blended_score: Optional[float] = None
    stage1_total_score: Optional[float] = None
    business_type: Optional[str] = None
    operating_model: Optional[str] = None
    reason_summary: Optional[str] = None
    triage: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full llm_triage_json when present (detail / expand).",
    )


class GptTargetCompaniesResponse(BaseModel):
    run_id: str
    total: int
    rows: List[GptTargetCompanyRow]


def _row_to_model(r: Dict[str, Any]) -> GptTargetCompanyRow:
    triage = r.get("llm_triage_json")
    if triage is not None and not isinstance(triage, dict):
        triage = None
    fit_raw = triage.get("is_fit_for_nivo") if triage else None
    is_fit: Optional[bool]
    if isinstance(fit_raw, bool):
        is_fit = fit_raw
    elif fit_raw is None:
        is_fit = None
    else:
        is_fit = str(fit_raw).lower() in ("true", "1", "yes")

    def _f(key: str) -> Optional[float]:
        if not triage:
            return None
        v = triage.get(key)
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def _s(key: str) -> Optional[str]:
        if not triage:
            return None
        v = triage.get(key)
        if v is None:
            return None
        return str(v)

    lat = r.get("llm_triage_at")
    lat_s = lat.isoformat() if hasattr(lat, "isoformat") else (str(lat) if lat else None)

    return GptTargetCompanyRow(
        orgnr=str(r.get("orgnr") or ""),
        company_name=r.get("company_name"),
        rank=r.get("rank"),
        gpt_official_website_url=r.get("gpt_official_website_url"),
        about_fetch_status=r.get("about_fetch_status"),
        llm_triage_at=lat_s,
        is_fit_for_nivo=is_fit,
        fit_confidence=_f("fit_confidence"),
        blended_score=_f("blended_score"),
        stage1_total_score=_f("stage1_total_score"),
        business_type=_s("business_type"),
        operating_model=_s("operating_model"),
        reason_summary=_s("reason_summary"),
        triage=triage,
    )


@router.get("/companies", response_model=GptTargetCompaniesResponse)
async def list_gpt_target_universe_companies(
    request: Request,
    q: Optional[str] = Query(None, description="Substring match on company_name or orgnr"),
    fit: Optional[bool] = Query(
        None,
        description="When true/false, filter rows where llm_triage_json.is_fit_for_nivo matches (requires triage).",
    ),
    has_triage: Optional[bool] = Query(
        None,
        description="When true, only rows with llm_triage_json; when false, only without.",
    ),
    min_fit_confidence: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum fit_confidence on triage rows (ignored for rows without triage).",
    ),
):
    _require_postgres()
    _require_user(request)
    run_id = _configured_run_id()

    where_parts: List[str] = ["w.run_id = %s::uuid"]
    params: List[Any] = [str(run_id)]

    if q and q.strip():
        where_parts.append(
            "(w.company_name ILIKE %s OR w.orgnr ILIKE %s OR REPLACE(w.orgnr, '-', '') ILIKE %s)"
        )
        pat = f"%{q.strip()}%"
        params.extend([pat, pat, f"%{q.strip().replace(' ', '').replace('-', '')}%"])

    if has_triage is True:
        where_parts.append("w.llm_triage_json IS NOT NULL")
    elif has_triage is False:
        where_parts.append("w.llm_triage_json IS NULL")

    if fit is True:
        where_parts.append("w.llm_triage_json @> '{\"is_fit_for_nivo\": true}'::jsonb")
    elif fit is False:
        where_parts.append("w.llm_triage_json @> '{\"is_fit_for_nivo\": false}'::jsonb")

    if min_fit_confidence is not None:
        where_parts.append(
            "w.llm_triage_json IS NOT NULL AND "
            "(w.llm_triage_json->>'fit_confidence')::double precision >= %s"
        )
        params.append(min_fit_confidence)

    where_sql = " AND ".join(where_parts)

    sql = f"""
        SELECT
            w.orgnr,
            w.company_name,
            w.rank,
            w.gpt_official_website_url,
            w.about_fetch_status,
            w.llm_triage_at,
            w.llm_triage_json
        FROM public.screening_website_research_companies w
        WHERE {where_sql}
        ORDER BY
            CASE WHEN w.llm_triage_json IS NULL THEN 1 ELSE 0 END,
            (w.llm_triage_json->>'fit_confidence')::double precision DESC NULLS LAST,
            (w.llm_triage_json->>'blended_score')::double precision DESC NULLS LAST,
            w.rank NULLS LAST,
            w.orgnr
        LIMIT {MAX_ROWS + 1}
    """

    db = get_database_service()
    try:
        raw_rows = db.run_raw_query(sql, params)
    except Exception as e:
        logger.warning("gpt_target_universe query failed: %s", e)
        raise HTTPException(400, f"Query failed: {e}") from e

    if len(raw_rows) > MAX_ROWS:
        raw_rows = raw_rows[:MAX_ROWS]

    rows = [_row_to_model(dict(r)) for r in raw_rows]
    return GptTargetCompaniesResponse(run_id=str(run_id), total=len(rows), rows=rows)
