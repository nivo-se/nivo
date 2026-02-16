"""
Coverage API: data coverage metrics for Universe page.
Powers "what we know vs don't know" - homepage, AI profile, 3Y financials, staleness.
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coverage", tags=["coverage"])

_IS_POSTGRES = os.getenv("DATABASE_SOURCE", "local").lower() == "postgres"


def _parse_segment_names(val: Any) -> List[str]:
    """Parse segment_names from JSON string (SQLite) or list (Postgres JSONB)."""
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x) for x in val if x]
    if isinstance(val, str):
        try:
            p = json.loads(val)
            return [str(x) for x in p] if isinstance(p, list) else []
        except json.JSONDecodeError:
            return []
    return []


@router.get("/snapshot")
async def coverage_snapshot():
    """
    Returns high-level coverage stats for the Universe.
    """
    db = get_database_service()

    if _IS_POSTGRES:
        sql = """
        SELECT
          COUNT(*)::int AS total_companies,
          ROUND(100.0 * AVG(CASE WHEN has_homepage THEN 1 ELSE 0 END), 1) AS has_homepage_pct,
          ROUND(100.0 * AVG(CASE WHEN has_ai_profile THEN 1 ELSE 0 END), 1) AS has_ai_profile_pct,
          ROUND(100.0 * AVG(CASE WHEN has_3y_financials THEN 1 ELSE 0 END), 1) AS has_3y_financials_pct,
          ROUND(100.0 * AVG(CASE WHEN (last_enriched_at IS NULL OR last_enriched_at < NOW() - INTERVAL '180 days') THEN 1 ELSE 0 END), 1) AS stale_pct,
          ROUND(AVG(data_quality_score)::numeric, 2) AS avg_data_quality_score
        FROM coverage_metrics;
        """
    else:
        # SQLite: inline from base tables
        sql = """
        SELECT
          COUNT(*) AS total_companies,
          ROUND(100.0 * AVG(CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END), 1) AS has_homepage_pct,
          ROUND(100.0 * AVG(CASE WHEN a.org_number IS NOT NULL THEN 1 ELSE 0 END), 1) AS has_ai_profile_pct,
          ROUND(100.0 * AVG(CASE WHEN (SELECT COUNT(DISTINCT f.year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END), 1) AS has_3y_financials_pct,
          ROUND(100.0 * AVG(CASE WHEN (a.last_updated IS NULL OR a.last_updated < date('now', '-180 days')) THEN 1 ELSE 0 END), 1) AS stale_pct,
          ROUND(AVG(
            (CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END) +
            (CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END) +
            (CASE WHEN (SELECT COUNT(DISTINCT f.year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END)
          ), 2) AS avg_data_quality_score
        FROM companies c
        LEFT JOIN ai_profiles a ON c.orgnr = a.org_number;
        """

    rows = db.run_raw_query(sql)
    row = rows[0] if rows else {}
    return {
        "total_companies": int(row.get("total_companies", 0)),
        "has_homepage_pct": float(row.get("has_homepage_pct", 0)),
        "has_ai_profile_pct": float(row.get("has_ai_profile_pct", 0)),
        "has_3y_financials_pct": float(row.get("has_3y_financials_pct", 0)),
        "stale_pct": float(row.get("stale_pct", 0)),
        "avg_data_quality_score": float(row.get("avg_data_quality_score", 0)),
    }


@router.get("/list")
async def coverage_list(
    q: Optional[str] = Query(default=None, description="Search by name or orgnr"),
    segment: Optional[str] = Query(default=None, description="Segment filter"),
    missing_homepage: bool = Query(default=False),
    missing_ai: bool = Query(default=False),
    missing_3y: bool = Query(default=False),
    stale_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """
    Returns paginated coverage rows.
    """
    db = get_database_service()

    where_parts: List[str] = ["TRUE"]
    params: List[Any] = []

    if q:
        if _IS_POSTGRES:
            where_parts.append("(cm.orgnr ILIKE ? OR cm.name ILIKE ?)")
        else:
            where_parts.append("(cm.orgnr LIKE ? OR cm.name LIKE ?)")
        q_pattern = f"%{q}%"
        params.extend([q_pattern, q_pattern])

    if segment:
        if _IS_POSTGRES:
            where_parts.append(
                "(cm.segment_names IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(cm.segment_names) s WHERE s ILIKE ?))"
            )
        else:
            where_parts.append(
                "(cm.segment_names IS NOT NULL AND cm.segment_names != '' AND EXISTS (SELECT 1 FROM json_each(cm.segment_names) WHERE value LIKE ?))"
            )
        params.append(f"%{segment}%")

    if missing_homepage:
        where_parts.append("cm.has_homepage = 0")
    if missing_ai:
        where_parts.append("cm.has_ai_profile = 0")
    if missing_3y:
        where_parts.append("cm.has_3y_financials = 0")
    if stale_only:
        if _IS_POSTGRES:
            where_parts.append(
                "(cm.last_enriched_at IS NULL OR cm.last_enriched_at < NOW() - INTERVAL '180 days')"
            )
        else:
            where_parts.append(
                "(cm.last_enriched_at IS NULL OR cm.last_enriched_at < date('now', '-180 days'))"
            )

    where_sql = " AND ".join(where_parts)
    params.extend([limit, offset])

    if _IS_POSTGRES:
        # Use coverage_metrics view (has name, segment_names from migration 014)
        sql_rows = f"""
        SELECT
          cm.orgnr,
          cm.name,
          cm.segment_names,
          cm.has_homepage,
          cm.has_ai_profile,
          cm.has_3y_financials,
          cm.last_enriched_at,
          (cm.last_enriched_at IS NULL OR cm.last_enriched_at < NOW() - INTERVAL '180 days') AS is_stale,
          cm.data_quality_score
        FROM coverage_metrics cm
        WHERE {where_sql}
        ORDER BY cm.data_quality_score ASC, cm.last_enriched_at NULLS FIRST
        LIMIT ? OFFSET ?
        """
        sql_total = f"""
        SELECT COUNT(*)::int AS total
        FROM coverage_metrics cm
        WHERE {where_sql}
        """
    else:
        # SQLite: inline subquery
        sql_rows = f"""
        SELECT
          cm.orgnr,
          cm.name,
          cm.segment_names,
          cm.has_homepage,
          cm.has_ai_profile,
          cm.has_3y_financials,
          cm.last_enriched_at,
          (cm.last_enriched_at IS NULL OR cm.last_enriched_at < date('now', '-180 days')) AS is_stale,
          cm.data_quality_score
        FROM (
          SELECT
            c.orgnr,
            c.company_name AS name,
            c.segment_names,
            (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
            (a.org_number IS NOT NULL) AS has_ai_profile,
            (SELECT COUNT(DISTINCT f.year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 AS has_3y_financials,
            a.last_updated AS last_enriched_at,
            (
              (CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END) +
              (CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END) +
              (CASE WHEN (SELECT COUNT(DISTINCT f.year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END)
            ) AS data_quality_score
          FROM companies c
          LEFT JOIN ai_profiles a ON c.orgnr = a.org_number
        ) cm
        WHERE {where_sql}
        ORDER BY cm.data_quality_score ASC, cm.last_enriched_at
        LIMIT ? OFFSET ?
        """
        sql_total = f"""
        SELECT COUNT(*) AS total
        FROM (
          SELECT
            c.orgnr,
            c.company_name AS name,
            c.segment_names,
            (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
            (a.org_number IS NOT NULL) AS has_ai_profile,
            (SELECT COUNT(DISTINCT f.year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 AS has_3y_financials,
            a.last_updated AS last_enriched_at
          FROM companies c
          LEFT JOIN ai_profiles a ON c.orgnr = a.org_number
        ) cm
        WHERE {where_sql}
        """

    # Postgres uses %s (converted from ? by postgres_db_service), SQLite uses ?
    rows = db.run_raw_query(sql_rows, params)
    total_params = params[:-2]  # exclude limit, offset for count
    total_rows = db.run_raw_query(sql_total, total_params)
    total = int(total_rows[0]["total"]) if total_rows else 0

    # Normalize row shape for frontend
    out: List[Dict[str, Any]] = []
    for r in rows:
        seg = r.get("segment_names")
        out.append({
            "orgnr": str(r.get("orgnr", "")),
            "name": r.get("name"),
            "segment_names": _parse_segment_names(seg),
            "has_homepage": bool(r.get("has_homepage")),
            "has_ai_profile": bool(r.get("has_ai_profile")),
            "has_3y_financials": bool(r.get("has_3y_financials")),
            "last_enriched_at": r.get("last_enriched_at"),
            "is_stale": bool(r.get("is_stale")),
            "data_quality_score": int(r.get("data_quality_score", 0)),
        })

    return {"rows": out, "total": total}
