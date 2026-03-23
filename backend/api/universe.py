"""
Universe query API: structured filter stack for Universe page.
Builds a schema-compatible source from base tables and supports filters + sort + pagination.
"""
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..services.db_factory import get_database_service
from .coverage import _parse_nace_codes, _parse_segment_names, _IS_POSTGRES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/universe", tags=["universe"])

KNOWN_FINANCIAL_TABLES = ("financials", "company_financials")
KNOWN_METRICS_TABLES = ("company_kpis", "company_metrics")
MIN_VALID_REVENUE_SEK = 50_000_000

# Whitelist: field -> SQL column (coverage_metrics)
FILTER_FIELDS = {
    "revenue_latest": "cm.revenue_latest",
    "ebitda_margin_latest": "cm.ebitda_margin_latest",
    "revenue_cagr_3y": "cm.revenue_cagr_3y",
    "employees_latest": "cm.employees_latest",
    "segment_names": "cm.segment_names",
    "nace_codes": "cm.nace_codes",
    "primary_nace": "cm.primary_nace",
    "name": "cm.name",
    "has_homepage": "cm.has_homepage",
    "has_ai_profile": "cm.has_ai_profile",
    "has_3y_financials": "cm.has_3y_financials",
    "data_quality_score": "cm.data_quality_score",
    "is_stale": "cm.is_stale",
    "fit_score": "cm.fit_score",
    "ops_upside_score": "cm.ops_upside_score",
    "nivo_total_score": "cm.nivo_total_score",
    "segment_tier": "cm.segment_tier",
    "research_feasibility_score": "cm.research_feasibility_score",
}

SORT_FIELDS = {
    "orgnr", "name", "data_quality_score", "last_enriched_at",
    "revenue_latest", "ebitda_margin_latest", "revenue_cagr_3y", "employees_latest",
    "has_homepage", "has_3y_financials", "is_stale",
    "fit_score", "ops_upside_score", "nivo_total_score", "segment_tier",
    "research_feasibility_score",
    "primary_nace",
}


FILTER_TAXONOMY = {
    "groups": [
        {
            "id": "financial",
            "label": "Financial",
            "items": [
                {"field": "revenue_latest", "label": "Revenue (latest fiscal year)", "type": "number", "ops": ["between", ">=", "<=", "="], "unit": "SEK"},
                {"field": "ebitda_margin_latest", "label": "EBITDA margin (latest fiscal year)", "type": "percent", "ops": [">=", "<=", "between", "="], "unit": "ratio"},
                {"field": "revenue_cagr_3y", "label": "Revenue CAGR (3Y)", "type": "percent", "ops": [">=", "<=", "between", "="], "unit": "ratio"},
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
                {"field": "name", "label": "Company name contains", "type": "text", "ops": ["contains"]},
                {"field": "segment_tier", "label": "Segment tier", "type": "text", "ops": ["="]},
            ],
        },
        {
            "id": "industry",
            "label": "Industry (SNI / NACE)",
            "items": [
                {
                    "field": "nace_codes",
                    "label": "Exclude SNI/NACE code prefixes (e.g. 49 Åkeri, 64 finance)",
                    "type": "nace",
                    "ops": ["excludes_prefixes"],
                    "unit": "prefixes",
                },
            ],
        },
        {
            "id": "scores",
            "label": "Screening scores",
            "items": [
                {"field": "fit_score", "label": "Fit score (0-100)", "type": "number", "ops": [">=", "<=", "between", "="]},
                {"field": "ops_upside_score", "label": "Ops upside score (0-100)", "type": "number", "ops": [">=", "<=", "between", "="]},
                {"field": "nivo_total_score", "label": "Nivo total score (0-200)", "type": "number", "ops": [">=", "<=", "between", "="]},
                {"field": "research_feasibility_score", "label": "Research feasibility (0-3)", "type": "number", "ops": [">=", "<=", "between", "="]},
            ],
        },
    ],
}


def _table_exists(db: Any, table_name: str) -> bool:
    if not hasattr(db, "table_exists"):
        return False
    try:
        return bool(db.table_exists(table_name))
    except Exception:
        return False


def _relation_has_columns(db: Any, relation_name: str, columns: Sequence[str]) -> bool:
    """Return True when all requested columns exist on a table/view."""
    if not columns:
        return True
    if not _table_exists(db, relation_name):
        return False
    try:
        rows = db.run_raw_query(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            """,
            [relation_name],
        )
        existing = {str(r.get("column_name")) for r in rows}
        return all(col in existing for col in columns)
    except Exception:
        return False


def _count_distinct_orgnrs(db: Any, table_name: str) -> int:
    if table_name not in KNOWN_FINANCIAL_TABLES + KNOWN_METRICS_TABLES:
        return 0
    if not _table_exists(db, table_name):
        return 0
    try:
        rows = db.run_raw_query(f"SELECT COUNT(DISTINCT orgnr)::int AS n FROM {table_name}")
        return int(rows[0].get("n", 0)) if rows else 0
    except Exception:
        return 0


def _pick_best_table(db: Any, candidates: Sequence[str]) -> Optional[str]:
    scores: List[Tuple[int, str]] = []
    for name in candidates:
        count = _count_distinct_orgnrs(db, name)
        if count > 0:
            scores.append((count, name))
    if not scores:
        for name in candidates:
            if _table_exists(db, name):
                return name
        return None
    scores.sort(key=lambda x: x[0], reverse=True)
    return scores[0][1]


def _annual_period_predicate(financials_table: Optional[str], alias: str = "f") -> str:
    if financials_table == "financials":
        return (
            f"({alias}.currency IS NULL OR {alias}.currency = 'SEK') "
            f"AND ({alias}.period = '12' OR RIGHT({alias}.period, 2) = '12')"
        )
    if financials_table == "company_financials":
        return f"({alias}.period = '12' OR RIGHT({alias}.period, 2) = '12')"
    return "FALSE"


def _financial_base_predicate(financials_table: Optional[str], alias: str = "f") -> str:
    if financials_table == "financials":
        return f"({alias}.currency IS NULL OR {alias}.currency = 'SEK')"
    if financials_table == "company_financials":
        return "TRUE"
    return "FALSE"


def _financial_revenue_expr(financials_table: Optional[str], alias: str = "f") -> str:
    if financials_table == "financials":
        return f"COALESCE({alias}.si_sek, {alias}.sdi_sek)"
    if financials_table == "company_financials":
        return f"{alias}.revenue_sek"
    return "NULL"


def _financial_ebitda_expr(financials_table: Optional[str], alias: str = "f") -> str:
    if financials_table == "financials":
        return f"COALESCE({alias}.ebitda_sek, {alias}.ors_sek)"
    if financials_table == "company_financials":
        return f"{alias}.ebitda_sek"
    return "NULL"


def _build_universe_source_subquery(db: Any) -> tuple[str, str, str]:
    metrics_table = _pick_best_table(db, KNOWN_METRICS_TABLES)
    financials_table = _pick_best_table(db, KNOWN_FINANCIAL_TABLES)

    annual_period_filter = _annual_period_predicate(financials_table, alias="f")
    base_financial_filter = _financial_base_predicate(financials_table, alias="f")
    fin_revenue_expr = _financial_revenue_expr(financials_table, alias="f")
    fin_ebitda_expr = _financial_ebitda_expr(financials_table, alias="f")

    has_3y_expr = "FALSE"
    if financials_table:
        has_3y_expr = (
            f"(SELECT COUNT(DISTINCT f.year) FROM {financials_table} f "
            f"WHERE f.orgnr = c.orgnr) >= 3"
        )

    metrics_join = ""
    metrics_revenue = "NULL"
    metrics_margin = "NULL"
    metrics_cagr = "NULL"
    metrics_equity_ratio = "NULL"
    metrics_debt_to_equity = "NULL"
    metrics_latest_year = "NULL"
    scores_join = ""
    fit_score_expr = "NULL"
    ops_upside_score_expr = "NULL"
    nivo_total_score_expr = "NULL"
    segment_tier_expr = "NULL"
    if metrics_table:
        metrics_join = f"LEFT JOIN {metrics_table} m ON m.orgnr = c.orgnr"
        metrics_revenue = "m.latest_revenue_sek"
        metrics_margin = "m.avg_ebitda_margin"
        metrics_cagr = "m.revenue_cagr_3y"
        metrics_equity_ratio = "m.equity_ratio_latest"
        metrics_debt_to_equity = "m.debt_to_equity_latest"
        metrics_latest_year = "m.latest_year"
        if metrics_table == "company_metrics":
            fit_score_expr = "m.fit_score"
            ops_upside_score_expr = "m.ops_upside_score"
            nivo_total_score_expr = "m.nivo_total_score"
            segment_tier_expr = "m.segment_tier"
        elif _table_exists(db, "company_metrics"):
            score_cols = ("fit_score", "ops_upside_score", "nivo_total_score", "segment_tier")
            if _relation_has_columns(db, "company_metrics", score_cols):
                scores_join = "LEFT JOIN company_metrics m_sc ON m_sc.orgnr = c.orgnr"
                fit_score_expr = "m_sc.fit_score"
                ops_upside_score_expr = "m_sc.ops_upside_score"
                nivo_total_score_expr = "m_sc.nivo_total_score"
                segment_tier_expr = "m_sc.segment_tier"
            else:
                logger.warning(
                    "Universe source: company_metrics exists but lacks required score columns; using NULL scores"
                )

    fin_latest_annual_join = ""
    fin_latest_any_join = ""
    fin_latest_annual_revenue = "NULL"
    fin_latest_annual_margin = "NULL"
    fin_latest_any_revenue = "NULL"
    fin_latest_any_margin = "NULL"
    latest_year_annual = "NULL"
    latest_year_any = "NULL"
    if financials_table:
        fin_latest_annual_join = f"""
      LEFT JOIN (
        SELECT DISTINCT ON (f.orgnr)
          f.orgnr,
          f.year AS latest_fin_year_annual,
          {fin_revenue_expr} AS revenue_latest_annual,
          {fin_ebitda_expr} AS ebitda_latest_annual
        FROM {financials_table} f
        WHERE {annual_period_filter}
        ORDER BY f.orgnr, f.year DESC, COALESCE(f.period, '') DESC
      ) fa ON fa.orgnr = c.orgnr
"""
        fin_latest_any_join = f"""
      LEFT JOIN (
        SELECT DISTINCT ON (f.orgnr)
          f.orgnr,
          f.year AS latest_fin_year_any,
          {fin_revenue_expr} AS revenue_latest_any,
          {fin_ebitda_expr} AS ebitda_latest_any
        FROM {financials_table} f
        WHERE {base_financial_filter}
        ORDER BY f.orgnr, f.year DESC, COALESCE(f.period, '') DESC
      ) fn ON fn.orgnr = c.orgnr
"""
        fin_latest_annual_revenue = "fa.revenue_latest_annual"
        fin_latest_any_revenue = "fn.revenue_latest_any"
        latest_year_annual = "fa.latest_fin_year_annual"
        latest_year_any = "fn.latest_fin_year_any"
        fin_latest_annual_margin = (
            "CASE WHEN fa.revenue_latest_annual IS NOT NULL "
            "AND fa.revenue_latest_annual > 0 "
            "AND fa.ebitda_latest_annual IS NOT NULL "
            "THEN fa.ebitda_latest_annual / fa.revenue_latest_annual "
            "ELSE NULL END"
        )
        fin_latest_any_margin = (
            "CASE WHEN fn.revenue_latest_any IS NOT NULL "
            "AND fn.revenue_latest_any > 0 "
            "AND fn.ebitda_latest_any IS NOT NULL "
            "THEN fn.ebitda_latest_any / fn.revenue_latest_any "
            "ELSE NULL END"
        )

    raw_revenue_latest_expr = (
        f"COALESCE({metrics_revenue}, {fin_latest_annual_revenue}, {fin_latest_any_revenue})"
    )
    raw_ebitda_margin_latest_expr = (
        f"COALESCE({metrics_margin}, {fin_latest_annual_margin}, {fin_latest_any_margin})"
    )
    revenue_latest_expr = (
        f"CASE WHEN ({raw_revenue_latest_expr}) >= {MIN_VALID_REVENUE_SEK} "
        f"THEN ({raw_revenue_latest_expr}) ELSE NULL END"
    )
    ebitda_margin_latest_expr = (
        f"CASE WHEN ({raw_revenue_latest_expr}) >= {MIN_VALID_REVENUE_SEK} "
        f"THEN ({raw_ebitda_margin_latest_expr}) ELSE NULL END"
    )

    source_sql = f"""
    (
      SELECT
        c.orgnr,
        c.company_name AS name,
        c.segment_names,
        (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
        (a.org_number IS NOT NULL) AS has_ai_profile,
        ({has_3y_expr}) AS has_3y_financials,
        a.last_updated AS last_enriched_at,
        (
          CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END +
          CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN ({has_3y_expr}) THEN 1 ELSE 0 END
        )::int AS data_quality_score,
        {revenue_latest_expr} AS revenue_latest,
        {ebitda_margin_latest_expr} AS ebitda_margin_latest,
        {metrics_cagr} AS revenue_cagr_3y,
        c.employees_latest AS employees_latest,
        (a.last_updated IS NULL OR a.last_updated < NOW() - INTERVAL '180 days') AS is_stale,
        COALESCE(c.address->>'municipality', c.address->>'region') AS municipality,
        c.homepage,
        c.email,
        c.phone,
        a.strategic_fit_score AS ai_strategic_fit_score,
        {metrics_equity_ratio} AS equity_ratio_latest,
        {metrics_debt_to_equity} AS debt_to_equity_latest,
        (COALESCE({metrics_latest_year}, {latest_year_annual}, {latest_year_any}))::int AS latest_year,
        {fit_score_expr} AS fit_score,
        {ops_upside_score_expr} AS ops_upside_score,
        {nivo_total_score_expr} AS nivo_total_score,
        {segment_tier_expr} AS segment_tier,
        (
          CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END +
          CASE WHEN ({has_3y_expr}) THEN 1 ELSE 0 END +
          CASE WHEN ({raw_revenue_latest_expr}) >= {MIN_VALID_REVENUE_SEK} THEN 1 ELSE 0 END
        )::int AS research_feasibility_score,
        CASE WHEN c.nace_codes IS NULL THEN NULL::jsonb ELSE c.nace_codes::jsonb END AS nace_codes,
        (CASE WHEN c.nace_codes IS NULL THEN NULL ELSE (c.nace_codes::jsonb->>0) END) AS primary_nace
      FROM companies c
      LEFT JOIN ai_profiles a ON c.orgnr = a.org_number
      {metrics_join}
      {scores_join}
      {fin_latest_annual_join}
      {fin_latest_any_join}
    ) cm
    """

    return source_sql, metrics_table or "none", financials_table or "none"


class FilterItem(BaseModel):
    field: str
    op: str
    value: Any
    type: str  # number, percent, boolean, text


class UniverseQueryPayload(BaseModel):
    filters: List[FilterItem] = []
    excludeFilters: Optional[List[FilterItem]] = None  # server-side exclude: rows matching these are excluded
    logic: str = "and"
    sort: Dict[str, Any] = {}
    limit: int = 50
    offset: int = 0
    q: Optional[str] = None  # search by name or orgnr
    profileId: Optional[str] = None  # optional screening profile: apply exclusion_rules and profile_weighted_score
    profileVersionId: Optional[str] = None  # optional; if omitted use active version


def _compile_nace_prefix_exclusion(
    value: Any, params: List[Any], db_is_postgres: bool
) -> Optional[str]:
    """
    Exclude rows where any SNI/NACE code in companies.nace_codes (JSON array) starts with
    one of the given digit prefixes (e.g. 49 = land transport, 64 = finance).
    """
    if not db_is_postgres:
        return None
    if not isinstance(value, (list, tuple)):
        return None
    prefixes: List[str] = []
    for p in value:
        s = str(p).strip().replace(" ", "")
        if not s:
            continue
        # 2–5 digit SNI/NACE section prefixes
        if s.isdigit() and 2 <= len(s) <= 5:
            prefixes.append(s)
    if not prefixes:
        return None
    or_parts: List[str] = []
    for _pfx in prefixes:
        params.append(f"{_pfx}%")
        or_parts.append("TRIM(elem) LIKE ?")
    inner = " OR ".join(or_parts)
    return (
        "(cm.nace_codes IS NULL OR NOT EXISTS ("
        "SELECT 1 FROM jsonb_array_elements_text(COALESCE(cm.nace_codes, '[]'::jsonb)) AS elem "
        "WHERE (" + inner + ")"
        "))"
    )


def _compile_filter(
    field: str, op: str, value: Any, value_type: str, params: List[Any], db_is_postgres: bool
) -> Optional[str]:
    """Compile one filter to SQL fragment. Returns None if invalid."""
    if field == "nace_codes" and op == "excludes_prefixes" and value_type == "nace":
        return _compile_nace_prefix_exclusion(value, params, db_is_postgres)

    col = FILTER_FIELDS.get(field)
    if not col:
        return None

    if value_type == "number":
        if op in ("gt", ">"):
            try:
                v = float(value)
                params.append(v)
                return f"{col} > ?"
            except (TypeError, ValueError):
                return None
        if op in ("gte", ">="):
            try:
                v = float(value)
                params.append(v)
                return f"{col} >= ?"
            except (TypeError, ValueError):
                return None
        if op in ("lt", "<"):
            try:
                v = float(value)
                params.append(v)
                return f"{col} < ?"
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
        if op in ("gt", ">"):
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} > ?"
        if op in ("gte", ">="):
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} >= ?"
        if op in ("lt", "<"):
            r = to_ratio(value)
            if r is None:
                return None
            params.append(r)
            return f"{col} < ?"
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

    if value_type == "text":
        if op == "contains":
            if value is None or str(value).strip() == "":
                return None
            pattern = f"%{str(value).strip()}%"
            if field == "name":
                params.append(pattern)
                return "(cm.name ILIKE ?)" if db_is_postgres else "(cm.name LIKE ?)"
            # segment_names: JSON array search
            if field == "segment_names":
                if db_is_postgres:
                    params.append(pattern)
                    return "(cm.segment_names IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(cm.segment_names) s WHERE s ILIKE ?))"
                else:
                    params.append(pattern)
                    return "(cm.segment_names IS NOT NULL AND cm.segment_names != '' AND EXISTS (SELECT 1 FROM json_each(cm.segment_names) WHERE value LIKE ?))"
        if op == "=":
            if value is None:
                return None
            params.append(str(value).strip())
            return f"{col} = ?"

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
        if field == "nace_codes" and op == "excludes_prefixes":
            val = getattr(f, "value", None)
            if isinstance(val, (list, tuple)) and len(val) > 0 and getattr(f, "type", "") == "nace":
                out.append(f)
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


# Field -> type for profile exclusion_rules (no type in JSON)
_EXCLUSION_FIELD_TYPES: Dict[str, str] = {
    "revenue_latest": "number",
    "ebitda_margin_latest": "percent",
    "revenue_cagr_3y": "percent",
    "employees_latest": "number",
    "data_quality_score": "number",
    "fit_score": "number",
    "ops_upside_score": "number",
    "nivo_total_score": "number",
    "research_feasibility_score": "number",
}


def _get_profile_config(db: Any, profile_id: str, version_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Load screening profile version config. Returns config_json or None."""
    if not getattr(db, "table_exists", lambda _: False)("screening_profile_versions"):
        return None
    if version_id:
        rows = db.run_raw_query(
            "SELECT config_json FROM screening_profile_versions WHERE id::text = ? AND profile_id::text = ? LIMIT 1",
            [version_id, profile_id],
        )
    else:
        rows = db.run_raw_query(
            "SELECT config_json FROM screening_profile_versions WHERE profile_id::text = ? AND is_active = true LIMIT 1",
            [profile_id],
        )
    if not rows or not rows[0].get("config_json"):
        return None
    cfg = rows[0]["config_json"]
    return cfg if isinstance(cfg, dict) else None


def _build_profile_exclusion_where(config: Dict[str, Any], params: List[Any], db_is_postgres: bool) -> Optional[str]:
    """Build SQL fragment NOT (rule1 OR rule2 OR ...) from config exclusion_rules. Returns None if no rules."""
    rules = config.get("exclusion_rules") or []
    if not rules:
        return None
    parts = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        field = rule.get("field")
        op = rule.get("op")
        value = rule.get("value")
        if not field or op is None:
            continue
        value_type = _EXCLUSION_FIELD_TYPES.get(field, "number")
        frag = _compile_filter(field, op, value, value_type, params, db_is_postgres)
        if frag:
            parts.append(frag)
    if not parts:
        return None
    return "NOT (" + " OR ".join(parts) + ")"


def _match_archetype_criteria(row: Dict[str, Any], criteria: Dict[str, Any]) -> bool:
    """Return True if row satisfies all criteria (field: { gte, lte, between })."""
    if not criteria or not isinstance(criteria, dict):
        return True
    for field, cond in criteria.items():
        if not isinstance(cond, dict):
            continue
        val = row.get(field)
        if val is None:
            return False
        try:
            v = float(val)
        except (TypeError, ValueError):
            if field in ("segment_tier", "name"):
                v_str = str(val).strip()
                if "gte" in cond and v_str < str(cond["gte"]):
                    return False
                if "lte" in cond and v_str > str(cond["lte"]):
                    return False
                if "eq" in cond and v_str != str(cond["eq"]):
                    return False
            continue
        if "gte" in cond:
            if v < float(cond["gte"]):
                return False
        if "lte" in cond:
            if v > float(cond["lte"]):
                return False
        if "between" in cond:
            br = cond["between"]
            if isinstance(br, (list, tuple)) and len(br) >= 2:
                if v < float(br[0]) or v > float(br[1]):
                    return False
    return True


def _get_archetype_code(row: Dict[str, Any], config: Dict[str, Any]) -> Optional[str]:
    """Return first matching archetype code from config.archetypes or None."""
    archetypes = config.get("archetypes") or []
    for arch in archetypes:
        if not isinstance(arch, dict):
            continue
        code = arch.get("code")
        criteria = arch.get("criteria") or arch.get("definition_json") or {}
        if not code:
            continue
        if _match_archetype_criteria(row, criteria):
            return str(code)
    return None


def _compute_profile_weighted_score(row: Dict[str, Any], config: Dict[str, Any]) -> Optional[float]:
    """Compute profile_weighted_score from config variables and weights. Returns 0-1 normalized score or None."""
    variables = config.get("variables") or []
    weights = config.get("weights") or {}
    if not variables or not weights:
        return None
    total_weight = 0.0
    weighted_sum = 0.0
    for var in variables:
        if not isinstance(var, dict):
            continue
        var_id = var.get("id")
        source = var.get("source")
        norm = var.get("normalize", "min_max")
        range_spec = var.get("range")
        if not var_id or not source or var_id not in weights:
            continue
        raw = row.get(source)
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        if norm == "min_max" and isinstance(range_spec, (list, tuple)) and len(range_spec) >= 2:
            lo, hi = float(range_spec[0]), float(range_spec[1])
            if hi <= lo:
                normalized = 0.0
            else:
                normalized = max(0.0, min(1.0, (val - lo) / (hi - lo)))
        elif norm == "linear" and isinstance(range_spec, (list, tuple)) and len(range_spec) >= 2:
            lo, hi = float(range_spec[0]), float(range_spec[1])
            if hi <= lo:
                normalized = 0.0
            else:
                normalized = max(0.0, min(1.0, (val - lo) / (hi - lo)))
        else:
            normalized = val if 0 <= val <= 1 else max(0.0, min(1.0, val))
        w = float(weights.get(var_id, 0))
        weighted_sum += w * normalized
        total_weight += w
    if total_weight <= 0:
        return None
    return round(weighted_sum / total_weight, 4)


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


def _materialize_universe_row(
    r: Dict[str, Any], profile_config: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Map a raw SQL row to API row dict; apply profile score + archetype when config present."""
    seg = r.get("segment_names")
    rev = r.get("revenue_latest")
    ai_score = r.get("ai_strategic_fit_score")
    fit = r.get("fit_score")
    ops = r.get("ops_upside_score")
    nivo = r.get("nivo_total_score")
    tier = r.get("segment_tier")
    nace_raw = r.get("nace_codes")
    row_dict: Dict[str, Any] = {
        "orgnr": str(r.get("orgnr", "")),
        "name": r.get("name"),
        "segment_names": _parse_segment_names(seg),
        "nace_codes": _parse_nace_codes(nace_raw),
        "primary_nace": str(r.get("primary_nace")).strip() if r.get("primary_nace") is not None else None,
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
        "latest_year": int(r.get("latest_year")) if r.get("latest_year") is not None else None,
        "fit_score": int(fit) if fit is not None else None,
        "ops_upside_score": int(ops) if ops is not None else None,
        "nivo_total_score": int(nivo) if nivo is not None else None,
        "segment_tier": str(tier) if tier is not None else None,
        "research_feasibility_score": int(r.get("research_feasibility_score")) if r.get("research_feasibility_score") is not None else None,
    }
    if profile_config:
        if profile_config.get("weights"):
            score = _compute_profile_weighted_score(row_dict, profile_config)
            row_dict["profile_weighted_score"] = score
        arch_code = _get_archetype_code(row_dict, profile_config)
        if arch_code:
            row_dict["archetype_code"] = arch_code
    return row_dict


def execute_universe_query(
    db: Any,
    body: UniverseQueryPayload,
    *,
    max_rows: Optional[int] = 200,
    offset: int = 0,
    stable_order_for_bulk: bool = False,
) -> tuple[list[Dict[str, Any]], int, Optional[Dict[str, Any]]]:
    """
    Run the same universe query as POST /api/universe/query.

    When max_rows is None, fetch all matching rows (no LIMIT) — used for screening Layer 0.
    Use stable_order_for_bulk=True to ORDER BY orgnr (cheap) instead of body.sort.

    Returns (rows, total_count, profile_config).
    """
    sanitized_filters = _sanitize_filters(body.filters or [])
    include_where, include_params = _build_where_from_stack(
        sanitized_filters, body.q, _IS_POSTGRES
    )
    sanitized_exclude = _sanitize_filters(body.excludeFilters or [])
    if sanitized_exclude:
        exclude_where, exclude_params = _build_where_from_stack(
            sanitized_exclude, None, _IS_POSTGRES
        )
        where_sql = f"({include_where}) AND NOT ({exclude_where})"
        params: List[Any] = include_params + exclude_params
    else:
        where_sql = include_where
        params = list(include_params)

    profile_config: Optional[Dict[str, Any]] = None
    if body.profileId and _IS_POSTGRES:
        try:
            profile_config = _get_profile_config(db, body.profileId, body.profileVersionId)
            if profile_config:
                profile_excl = _build_profile_exclusion_where(profile_config, params, _IS_POSTGRES)
                if profile_excl:
                    where_sql = f"({where_sql}) AND ({profile_excl})"
        except Exception as e:
            logger.warning("Universe query: profile config load failed: %s", e)

    if stable_order_for_bulk:
        order_sql = "cm.orgnr ASC"
    else:
        order_sql = _build_order(body.sort, _IS_POSTGRES)

    select_cols = (
        "cm.orgnr, cm.name, cm.segment_names, cm.nace_codes, cm.primary_nace, cm.has_homepage, cm.has_ai_profile, "
        "cm.has_3y_financials, cm.last_enriched_at, cm.is_stale, cm.data_quality_score, "
        "cm.revenue_latest, cm.ebitda_margin_latest, cm.revenue_cagr_3y, cm.employees_latest, "
        "cm.municipality, cm.homepage, cm.email, cm.phone, cm.ai_strategic_fit_score, "
        "cm.equity_ratio_latest, cm.debt_to_equity_latest, cm.latest_year, "
        "cm.fit_score, cm.ops_upside_score, cm.nivo_total_score, cm.segment_tier, "
        "cm.research_feasibility_score"
    )

    if not _IS_POSTGRES:
        return [], 0, profile_config

    source_sql, metrics_table, financials_table = _build_universe_source_subquery(db)
    logger.debug(
        "Universe source tables: metrics=%s financials=%s",
        metrics_table,
        financials_table,
    )
    sql_total = f"SELECT COUNT(*)::int AS total FROM {source_sql} WHERE {where_sql}"
    total_params = list(params)

    if max_rows is None:
        sql_rows = f"""
        SELECT {select_cols}
        FROM {source_sql}
        WHERE {where_sql}
        ORDER BY {order_sql}
        """
        query_params = params
    else:
        lim = max(1, max_rows)
        off = max(0, offset)
        sql_rows = f"""
        SELECT {select_cols}
        FROM {source_sql}
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ? OFFSET ?
        """
        query_params = params + [lim, off]

    def _run_query():
        r = db.run_raw_query(sql_rows, query_params)
        t = db.run_raw_query(sql_total, total_params)
        return r, t

    rows, total_rows = _run_query()
    total = int(total_rows[0]["total"]) if total_rows else 0

    out: list[Dict[str, Any]] = []
    for r in rows:
        out.append(_materialize_universe_row(r, profile_config))
    return out, total, profile_config


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

    try:
        rows, total, _ = await asyncio.to_thread(
            execute_universe_query,
            db,
            body,
            max_rows=limit,
            offset=offset,
            stable_order_for_bulk=False,
        )
    except Exception as e:
        logger.warning("Universe query: execution failed: %s", e)
        return {"rows": [], "total": 0}

    return {"rows": rows, "total": total}
