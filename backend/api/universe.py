"""
Universe query API: structured filter stack for Universe page.
Uses coverage_metrics view; supports filters + sort + pagination.
"""
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..services.db_factory import get_database_service
from .coverage import _parse_segment_names, _IS_POSTGRES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/universe", tags=["universe"])

# Whitelist: field -> SQL column (coverage_metrics)
FILTER_FIELDS = {
    "revenue_latest": "cm.revenue_latest",
    "ebitda_margin_latest": "cm.ebitda_margin_latest",
    "revenue_cagr_3y": "cm.revenue_cagr_3y",
    "employees_latest": "cm.employees_latest",
    "segment_names": "cm.segment_names",
    "has_homepage": "cm.has_homepage",
    "has_ai_profile": "cm.has_ai_profile",
    "has_3y_financials": "cm.has_3y_financials",
    "data_quality_score": "cm.data_quality_score",
    "is_stale": "cm.is_stale",
}

SORT_FIELDS = {
    "orgnr", "name", "data_quality_score", "last_enriched_at",
    "revenue_latest", "ebitda_margin_latest", "revenue_cagr_3y", "employees_latest",
    "has_homepage", "has_3y_financials", "is_stale",
}


FILTER_TAXONOMY = {
    "groups": [
        {
            "id": "financial",
            "label": "Financial",
            "items": [
                {"field": "revenue_latest", "label": "Revenue (latest)", "type": "number", "ops": ["between", ">=", "<=", "="], "unit": "SEK"},
                {"field": "ebitda_margin_latest", "label": "EBITDA margin (latest)", "type": "percent", "ops": [">=", "<=", "between", "="], "unit": "ratio"},
                {"field": "revenue_cagr_3y", "label": "Revenue CAGR (3y)", "type": "percent", "ops": [">=", "<=", "between", "="], "unit": "ratio"},
                {"field": "employees_latest", "label": "Employees (latest)", "type": "number", "ops": [">=", "<=", "between", "="]},
            ],
        },
        {
            "id": "coverage",
            "label": "Coverage & Freshness",
            "items": [
                {"field": "has_homepage", "label": "Has homepage", "type": "boolean", "ops": ["="]},
                {"field": "has_ai_profile", "label": "Has AI profile", "type": "boolean", "ops": ["="]},
                {"field": "has_3y_financials", "label": "Has 3Y financials", "type": "boolean", "ops": ["="]},
                {"field": "data_quality_score", "label": "Data quality score", "type": "number", "ops": [">=", "<=", "between", "="]},
                {"field": "is_stale", "label": "Stale enrichment", "type": "boolean", "ops": ["="]},
            ],
        },
        {
            "id": "segment",
            "label": "Segment",
            "items": [
                {"field": "segment_names", "label": "Segment name contains", "type": "text", "ops": ["contains"]},
            ],
        },
    ],
}


class FilterItem(BaseModel):
    field: str
    op: str
    value: Any
    type: str  # number, percent, boolean, text


class UniverseQueryPayload(BaseModel):
    filters: List[FilterItem] = []
    logic: str = "and"
    sort: Dict[str, Any] = {}
    limit: int = 50
    offset: int = 0
    q: Optional[str] = None  # search by name or orgnr


def _compile_filter(
    field: str, op: str, value: Any, value_type: str, params: List[Any], db_is_postgres: bool
) -> Optional[str]:
    """Compile one filter to SQL fragment. Returns None if invalid."""
    col = FILTER_FIELDS.get(field)
    if not col:
        return None

    if value_type == "number":
        if op == ">=":
            try:
                v = float(value)
                params.append(v)
                return f"{col} >= ?"
            except (TypeError, ValueError):
                return None
        if op == "<=":
            try:
                v = float(value)
                params.append(v)
                return f"{col} <= ?"
            except (TypeError, ValueError):
                return None
        if op == "=":
            try:
                v = float(value)
                params.append(v)
                return f"{col} = ?"
            except (TypeError, ValueError):
                return None
        if op == "between":
            if not isinstance(value, (list, tuple)) or len(value) < 1:
                return None
            try:
                lo = float(value[0]) if value[0] is not None else None
                hi = float(value[1]) if len(value) > 1 and value[1] is not None else None
                if lo is None:
                    return None
                if hi is None:
                    params.append(lo)
                    return f"{col} >= ?"
                params.extend([lo, hi])
                return f"{col} BETWEEN ? AND ?"
            except (TypeError, ValueError):
                return None

    if value_type == "percent":
        # Stored as ratio (0.12 = 12%). UI may send 12 or 0.12
        def to_ratio(v) -> Optional[float]:
            try:
                f = float(v)
                return f / 100.0 if f > 1 else f
            except (TypeError, ValueError):
                return None
        if op == ">=":
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} >= ?"
        if op == "<=":
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} <= ?"
        if op == "=":
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} = ?"
        if op == "between":
            if not isinstance(value, (list, tuple)) or len(value) < 1:
                return None
            lo, hi = to_ratio(value[0]), to_ratio(value[1]) if len(value) > 1 else None
            if lo is None:
                return None
            if hi is None:
                params.append(lo)
                return f"{col} >= ?"
            params.extend([lo, hi])
            return f"{col} BETWEEN ? AND ?"

    if value_type == "boolean":
        if op != "=":
            return None
        # Accept both boolean and string representations
        b = value in (True, "true", "1", 1)
        if value in (False, "false", "0", 0):
            b = False
        params.append(b)
        return f"{col} = ?"

    if value_type == "text" and op == "contains":
        if value is None or str(value).strip() == "":
            return None
        pattern = f"%{str(value).strip()}%"
        if db_is_postgres:
            params.append(pattern)
            return "(cm.segment_names IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(cm.segment_names) s WHERE s ILIKE ?))"
        else:
            params.append(pattern)
            return "(cm.segment_names IS NOT NULL AND cm.segment_names != '' AND EXISTS (SELECT 1 FROM json_each(cm.segment_names) WHERE value LIKE ?))"

    return None


def _sanitize_filters(filters: List[FilterItem]) -> List[FilterItem]:
    """Drop incomplete filter rows (missing field/op/value) to prevent invalid SQL."""
    out = []
    for f in filters or []:
        if not f:
            continue
        field = (getattr(f, "field", None) or "")
        op = (getattr(f, "op", None) or "")
        if not isinstance(field, str) or not field.strip():
            continue
        if not isinstance(op, str) or not op.strip():
            continue
        field = field.strip()
        op = op.strip()
        if field not in FILTER_FIELDS:
            continue
        if op not in ("=", ">=", "<=", "between", "contains", "!="):
            continue
        if getattr(f, "value", None) is None and getattr(f, "type", "") != "boolean":
            continue
        out.append(f)
    return out


def _build_where_from_stack(
    filters: List[FilterItem], q: Optional[str], db_is_postgres: bool
) -> tuple[str, List[Any]]:
    """Build WHERE from filter stack + optional search q."""
    where_parts = ["TRUE"]
    params: List[Any] = []

    if q and str(q).strip():
        pattern = f"%{q.strip()}%"
        params.extend([pattern, pattern])
        where_parts.append("(cm.orgnr ILIKE ? OR cm.name ILIKE ?)" if db_is_postgres else "(cm.orgnr LIKE ? OR cm.name LIKE ?)")

    for f in filters:
        frag = _compile_filter(f.field, f.op, f.value, f.type, params, db_is_postgres)
        if frag:
            where_parts.append(frag)

    return " AND ".join(where_parts), params


def _build_order(sort: Optional[Dict], db_is_postgres: bool) -> str:
    """Build ORDER BY. Validates sort field; fallback to orgnr if invalid."""
    if not sort or not isinstance(sort, dict):
        sort = {}
    by_raw = sort.get("by") or sort.get("column")
    by = str(by_raw).strip() if by_raw else "orgnr"
    dir = str(sort.get("dir") or sort.get("direction") or "asc").lower()
    if by not in SORT_FIELDS:
        by = "orgnr"  # Safe fallback: always exists in coverage_metrics
    direction = "DESC" if dir == "desc" else "ASC"
    nulls = " NULLS LAST" if direction == "DESC" else " NULLS FIRST"
    return f"cm.{by} {direction}{nulls}, cm.orgnr ASC"


@router.get("/filters")
async def get_filter_taxonomy():
    """Return filter taxonomy for UI picker (field, type, ops, unit)."""
    return FILTER_TAXONOMY


@router.post("/query")
async def universe_query(request: Request, body: UniverseQueryPayload):
    """
    Query Universe with structured filter stack.
    Request: { filters: [{field, op, value, type}], logic, sort: {by, dir}, limit, offset, q? }
    Response: { rows, total }
    """
    try:
        db = get_database_service()
    except Exception as e:
        logger.warning("Universe query: get_database_service failed: %s", e)
        return {"rows": [], "total": 0}

    limit = min(max(body.limit, 1), 200)
    offset = max(body.offset, 0)

    sanitized_filters = _sanitize_filters(body.filters or [])
    where_sql, params = _build_where_from_stack(
        sanitized_filters, body.q, _IS_POSTGRES
    )
    order_sql = _build_order(body.sort, _IS_POSTGRES)
    params.extend([limit, offset])

    select_cols = (
        "cm.orgnr, cm.name, cm.segment_names, cm.has_homepage, cm.has_ai_profile, "
        "cm.has_3y_financials, cm.last_enriched_at, cm.is_stale, cm.data_quality_score, "
        "cm.revenue_latest, cm.ebitda_margin_latest, cm.revenue_cagr_3y, cm.employees_latest, "
        "cm.municipality, cm.homepage, cm.email, cm.phone, cm.ai_strategic_fit_score, "
        "cm.equity_ratio_latest, cm.debt_to_equity_latest"
    )

    if _IS_POSTGRES:
        sql_rows = f"""
        SELECT {select_cols}
        FROM coverage_metrics cm
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ? OFFSET ?
        """
        sql_total = f"SELECT COUNT(*)::int AS total FROM coverage_metrics cm WHERE {where_sql}"
    else:
        # SQLite: Universe query requires Postgres (coverage_metrics + financial cols)
        sql_rows = "SELECT 1 AS _ LIMIT 0"
        sql_total = "SELECT 0 AS total"

    total_params = params[:-2]

    def _run_query():
        r = db.run_raw_query(sql_rows, params)
        t = db.run_raw_query(sql_total, total_params)
        return r, t

    try:
        rows, total_rows = await asyncio.to_thread(_run_query)
        total = int(total_rows[0]["total"]) if total_rows else 0
    except Exception as e:
        logger.warning("Universe query: execution failed: %s", e)
        return {"rows": [], "total": 0}

    out = []
    for r in rows:
        seg = r.get("segment_names")
        rev = r.get("revenue_latest")
        ai_score = r.get("ai_strategic_fit_score")
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
            "revenue_latest": float(rev) if rev is not None else None,
            "ebitda_margin_latest": float(r.get("ebitda_margin_latest")) if r.get("ebitda_margin_latest") is not None else None,
            "revenue_cagr_3y": float(r.get("revenue_cagr_3y")) if r.get("revenue_cagr_3y") is not None else None,
            "employees_latest": int(r.get("employees_latest")) if r.get("employees_latest") is not None else None,
            "municipality": r.get("municipality"),
            "homepage": r.get("homepage"),
            "email": r.get("email"),
            "phone": r.get("phone"),
            "ai_strategic_fit_score": int(ai_score) if ai_score is not None else None,
            "equity_ratio_latest": float(r.get("equity_ratio_latest")) if r.get("equity_ratio_latest") is not None else None,
            "debt_to_equity_latest": float(r.get("debt_to_equity_latest")) if r.get("debt_to_equity_latest") is not None else None,
        })

    return {"rows": out, "total": total}
