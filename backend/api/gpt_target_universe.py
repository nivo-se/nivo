"""
Read-only API for the fixed GPT website-research + Layer2 triage universe.

Run id resolution (first match wins):
1. Optional query param ``run_id`` (UUID).
2. Env ``GPT_TARGET_UNIVERSE_RUN_ID`` when set to a valid UUID.
3. Else the latest ``screening_runs`` row (by ``created_at``) that has at least one
   ``screening_website_research_companies`` row.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple
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


def _auto_latest_website_research_run_id(db: Any) -> Optional[UUID]:
    """Newest screening_runs row (by created_at) that has website-research company rows."""
    try:
        rows = db.run_raw_query(
            """
            SELECT r.id AS id
            FROM public.screening_runs r
            INNER JOIN public.screening_website_research_companies w ON w.run_id = r.id
            GROUP BY r.id, r.created_at
            ORDER BY r.created_at DESC
            LIMIT 1
            """
        )
    except Exception:
        logger.debug("auto_latest website-research run_id lookup failed", exc_info=True)
        return None
    if not rows:
        return None
    val = rows[0].get("id")
    if val is None:
        return None
    return UUID(str(val))


def _resolve_run_id_soft(db: Any, query_run_id: Optional[str]) -> Tuple[Optional[UUID], str, Optional[str]]:
    """
    Returns (run_uuid_or_none, resolution_tag, error_detail).
    resolution_tag: query_param | environment | auto_latest | none | invalid_query | invalid_env
    """
    q = (query_run_id or "").strip()
    if q:
        try:
            return UUID(q), "query_param", None
        except ValueError:
            return None, "invalid_query", f"run_id is not a valid UUID: {q}"

    raw = (os.getenv("GPT_TARGET_UNIVERSE_RUN_ID") or "").strip()
    if raw:
        try:
            return UUID(raw), "environment", None
        except ValueError as e:
            return None, "invalid_env", str(e)

    auto = _auto_latest_website_research_run_id(db)
    if auto:
        return auto, "auto_latest", None
    return None, "none", None


def _resolve_run_id_required(db: Any, query_run_id: Optional[str]) -> Tuple[UUID, str]:
    rid, tag, err = _resolve_run_id_soft(db, query_run_id)
    if rid is not None:
        return rid, tag
    if tag == "invalid_query":
        raise HTTPException(400, err or "Invalid run_id query parameter") from None
    if tag == "invalid_env":
        raw = (os.getenv("GPT_TARGET_UNIVERSE_RUN_ID") or "").strip()
        raise HTTPException(503, f"GPT_TARGET_UNIVERSE_RUN_ID is not a valid UUID: {raw}") from None
    raise HTTPException(
        503,
        "No GPT target universe run: set GPT_TARGET_UNIVERSE_RUN_ID, pass ?run_id=<uuid>, "
        "or ingest rows into screening_website_research_companies (no runs with data were found).",
    )


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


class GptTargetUniverseMeta(BaseModel):
    """Lightweight config/dataset checks for troubleshooting (same auth as /companies)."""

    database_source_postgres: bool
    env_run_id_set: bool
    run_id: Optional[str] = None
    run_id_resolution: Optional[str] = None
    run_id_parse_error: Optional[str] = None
    table_screening_website_research_companies: bool = False
    table_check_error: Optional[str] = None
    row_count: Optional[int] = None
    row_count_error: Optional[str] = None


class GptTargetRunOption(BaseModel):
    run_id: str
    run_kind: str
    created_at: str
    row_count: int


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


@router.get("/meta", response_model=GptTargetUniverseMeta)
async def gpt_target_universe_meta(
    request: Request,
    run_id: Optional[str] = Query(
        None,
        description="Same override as /companies — when set, diagnostics target this run.",
    ),
):
    """Return env/table/row-count hints without applying list filters."""
    _require_user(request)
    ds = (os.getenv("DATABASE_SOURCE", "postgres") or "").lower()
    raw_env = (os.getenv("GPT_TARGET_UNIVERSE_RUN_ID") or "").strip()
    meta: Dict[str, Any] = {
        "database_source_postgres": ds == "postgres",
        "env_run_id_set": bool(raw_env),
        "run_id": None,
        "run_id_resolution": None,
        "run_id_parse_error": None,
        "table_screening_website_research_companies": False,
        "table_check_error": None,
        "row_count": None,
        "row_count_error": None,
    }

    if ds != "postgres":
        return GptTargetUniverseMeta(**meta)

    db = get_database_service()
    try:
        chk = db.run_raw_query(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'screening_website_research_companies'
            ) AS e
            """
        )
        meta["table_screening_website_research_companies"] = bool(chk and chk[0].get("e"))
    except Exception as e:
        meta["table_check_error"] = str(e)
        return GptTargetUniverseMeta(**meta)

    rid_uuid, tag, err = _resolve_run_id_soft(db, run_id)
    meta["run_id_resolution"] = tag
    if tag == "invalid_env":
        meta["run_id_parse_error"] = err
    elif tag == "invalid_query":
        meta["run_id_parse_error"] = err
    if rid_uuid is not None:
        meta["run_id"] = str(rid_uuid)

    rid = meta.get("run_id")
    if rid and meta["table_screening_website_research_companies"]:
        try:
            cnt = db.run_raw_query(
                "SELECT COUNT(*)::int AS c FROM public.screening_website_research_companies WHERE run_id = %s::uuid",
                [rid],
            )
            meta["row_count"] = int(cnt[0]["c"]) if cnt else 0
        except Exception as e:
            meta["row_count_error"] = str(e)

    return GptTargetUniverseMeta(**meta)


@router.get("/runs", response_model=List[GptTargetRunOption])
async def list_gpt_target_runs(request: Request):
    """Runs that have at least one website-research company row (newest first)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    try:
        raw_rows = db.run_raw_query(
            """
            SELECT r.id::text AS run_id, r.run_kind, r.created_at, COUNT(w.orgnr)::int AS row_count
            FROM public.screening_runs r
            INNER JOIN public.screening_website_research_companies w ON w.run_id = r.id
            GROUP BY r.id, r.run_kind, r.created_at
            ORDER BY r.created_at DESC
            LIMIT 50
            """
        )
    except Exception as e:
        logger.warning("gpt_target_universe /runs failed: %s", e)
        return []

    out: List[GptTargetRunOption] = []
    for r in raw_rows:
        ca = r.get("created_at")
        ca_s = ca.isoformat() if hasattr(ca, "isoformat") else str(ca)
        out.append(
            GptTargetRunOption(
                run_id=str(r.get("run_id") or ""),
                run_kind=str(r.get("run_kind") or ""),
                created_at=ca_s,
                row_count=int(r.get("row_count") or 0),
            )
        )
    return out


@router.get("/companies", response_model=GptTargetCompaniesResponse)
async def list_gpt_target_universe_companies(
    request: Request,
    run_id: Optional[str] = Query(
        None,
        description="Override GPT_TARGET_UNIVERSE_RUN_ID for this request (UUID of a screening run).",
    ),
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
    db = get_database_service()
    run_uuid, _res_tag = _resolve_run_id_required(db, run_id)

    where_parts: List[str] = ["w.run_id = %s::uuid"]
    params: List[Any] = [str(run_uuid)]

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

    try:
        raw_rows = db.run_raw_query(sql, params)
    except Exception as e:
        logger.warning("gpt_target_universe query failed: %s", e)
        raise HTTPException(400, f"Query failed: {e}") from e

    if len(raw_rows) > MAX_ROWS:
        raw_rows = raw_rows[:MAX_ROWS]

    rows = [_row_to_model(dict(r)) for r in raw_rows]
    return GptTargetCompaniesResponse(run_id=str(run_uuid), total=len(rows), rows=rows)
