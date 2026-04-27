"""
Stage 1: Financial Filtering

Filters companies based on hard financial metrics to create initial shortlist.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from openai import OpenAI

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)


@dataclass
class FilterCriteria:
    """Financial filtering criteria"""
    min_revenue: float = 0
    min_ebitda_margin: float = -1.0
    min_growth: float = -1.0
    industries: Optional[List[str]] = None
    max_results: int = 500
    custom_sql_conditions: List[str] = field(default_factory=list)
    description: str = ""  # The user's natural language request
    suggestions: List[str] = field(default_factory=list) # AI generated follow-up questions


def filter_criteria_from_dict(d: Optional[Dict[str, Any]]) -> FilterCriteria:
    """Build FilterCriteria from client JSON (sourcing chat / save-as-list)."""
    if not d:
        return FilterCriteria()
    allowed = {
        "min_revenue",
        "min_ebitda_margin",
        "min_growth",
        "industries",
        "max_results",
        "custom_sql_conditions",
        "description",
        "suggestions",
    }
    clean = {k: v for k, v in d.items() if k in allowed}
    return FilterCriteria(**clean)


def _has_company_name_sql(conditions: Optional[List[str]]) -> bool:
    return any((c or "").strip() and "company_name" in c.lower() for c in conditions or [])


def _prompt_suggests_financials(prompt: str) -> bool:
    return bool(
        re.search(
            r"(\d+\s*[-–]?\s*\d*|\>\s*\d+|msek|\bsek\b|million|revenue|omsättning|margin|ebitda|growth|cagr|profitable)",
            prompt,
            re.I,
        )
    )


def _extract_focus_company_name(prompt: str) -> Optional[str]:
    """Best-effort name token from natural language when the LLM omits custom_sql."""
    patterns = [
        r"with the name\s+([^\.\n]+?)(?:\.|$|\n)",
        r"\bfor the company\s+([^\.\n]+?)(?:\.|$|\n)",
        r"\bfilter(?:ed)?\s+for\s+(?:the\s+)?company\s+([^\.\n]+?)(?:\.|$|\n)",
        r"\bnamed\s+([^\.\n]+?)(?:\.|$|\n)",
        r"\bcalled\s+([^\.\n]+?)(?:\.|$|\n)",
    ]
    for pat in patterns:
        m = re.search(pat, prompt, re.I | re.MULTILINE)
        if not m:
            continue
        raw = m.group(1).strip().strip("\"'")
        raw = raw.rstrip(".,;:")
        if len(raw) >= 2:
            return raw
    return None


def _augment_criteria_for_company_name_prompt(prompt: str, criteria: FilterCriteria) -> None:
    """
    If the user is clearly asking for a company by name but the model forgot custom_sql,
    add ILIKE on c.company_name. Clear stale financial floors when the message is name-only
    so LEFT JOIN + no KPI row still returns the company.
    """
    if _has_company_name_sql(criteria.custom_sql_conditions):
        return
    name = _extract_focus_company_name(prompt)
    if not name:
        return
    safe = name.replace("'", "''").replace("%", "")
    if not safe:
        return
    crit_list = list(criteria.custom_sql_conditions or [])
    crit_list.append(f"c.company_name ILIKE '%{safe}%'")
    criteria.custom_sql_conditions = crit_list
    if not _prompt_suggests_financials(prompt):
        criteria.min_revenue = 0
        criteria.min_ebitda_margin = -1.0
        criteria.min_growth = -1.0
    logger.info("Augmented filter with name ILIKE from prompt: %s", safe[:80])


def humanize_filter_criteria(criteria: FilterCriteria) -> str:
    """
    Short, human-readable explanation of active filters (not raw JSON).
    Use for UI and saved list notes.
    """
    lines: List[str] = []
    if (criteria.description or "").strip():
        lines.append(criteria.description.strip())

    details: List[str] = []
    if criteria.min_revenue > 0:
        msek = criteria.min_revenue / 1_000_000.0
        if msek >= 0.1:
            details.append(f"Minimum revenue: about {msek:.1f} MSEK")
        else:
            details.append(f"Minimum revenue: {criteria.min_revenue:,.0f} SEK")
    if criteria.min_ebitda_margin > -1.0:
        details.append(f"Minimum EBITDA margin: {criteria.min_ebitda_margin * 100:.1f}%")
    if criteria.min_growth > -1.0:
        details.append(f"Minimum 3-year revenue CAGR: {criteria.min_growth * 100:.1f}%")
    if criteria.industries:
        details.append(f"Industry (NACE) codes: {', '.join(criteria.industries)}")
    for cond in criteria.custom_sql_conditions or []:
        c = (cond or "").strip()
        if c:
            details.append(f"Rule: {c}")

    if details:
        if lines:
            lines.append("")
        lines.append("Active constraints:")
        for item in details:
            lines.append(f"• {item}")

    if not lines:
        return "No specific financial filters (matches all companies in the metrics set)."

    return "\n".join(lines)


def _llm_config() -> tuple[Optional[OpenAI], str]:
    """
    Sourcing chat uses the OpenAI Python SDK.
    - Default: OpenAI API with OPENAI_API_KEY (or LLM_API_KEY) and OPENAI_MODEL / LLM_MODEL.
    - Optional: OpenAI-compatible server (e.g. LM Studio) via LLM_BASE_URL + key (dummy ok).
    See .env.example (OpenAI / LLM section).
    """
    base = (os.getenv("LLM_BASE_URL") or "").strip()
    key = (os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY") or "").strip()
    if not key and base:
        key = (os.getenv("LLM_API_KEY") or "lm-studio").strip()
    if not key and not base:
        return None, (os.getenv("OPENAI_MODEL") or os.getenv("LLM_MODEL") or "gpt-4o-mini").strip()
    kwargs: dict = {"api_key": key}
    if base:
        kwargs["base_url"] = base
    model = (os.getenv("LLM_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip()
    return OpenAI(**kwargs), model


class IntentAnalyzer:
    """Analyzes user intent to create filter criteria"""
    
    def __init__(self) -> None:
        self.client, self.model = _llm_config()

    def parse_prompt(
        self,
        prompt: str,
        current_criteria: Optional[FilterCriteria] = None,
        *,
        nivo_thesis_block: str = "",
        history_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> FilterCriteria:
        """
        Convert natural language prompt to FilterCriteria.

        `nivo_thesis_block` is appended to the system prompt (versioned Nivo mandate).
        `history_messages` are prior OpenAI-shaped messages; current turn is `prompt` only.
        """
        logger.info(f"Parsing prompt: {prompt}")
        
        system_prompt = """You are an expert data analyst translating M&A theses into SQL filters.
        
        Database Schema:
        - companies (c): orgnr, company_name, description, city, country, nace_codes (JSONB array of NACE strings — use this name, not nace_categories)
        - company_metrics (m): view over company_kpis; latest_revenue_sek, avg_ebitda_margin (0.15=15%), revenue_cagr_3y (0.10=10%), employees_latest
        
        CRITICAL — how results are computed:
        - The runtime uses INNER JOIN to company_metrics for pure financial/NACE universe queries, and LEFT JOIN when custom_sql_conditions is non-empty (name/city/etc.) so companies without KPI rows can still match if you are not filtering on m.* fields.
        - Financial filters (min revenue, margin, growth) reference (m); rows without metrics are excluded for those predicates (NULL never passes >=).
        - For a specific company name, ALWAYS set custom_sql_conditions with Postgres ILIKE on c.company_name, e.g. "c.company_name ILIKE '%Texstar%'".
        - If the user only asks for a company by name (no revenue/margin/growth in the same message), set min_revenue=0, min_ebitda_margin=-1, min_growth=-1 so prior-turn financial filters are not kept.
        
        Task:
        1. Update the filter criteria based on the user's latest message.
        2. Generate 2-3 relevant follow-up questions (suggestions) to help the user refine their search.
        
        If the user says "refine" or "add", keep existing criteria and add new ones.
        If the user says "start over" or changes topic completely, reset.
        
        Return JSON:
        {
            "min_revenue": 10000000,
            "min_ebitda_margin": 0.05,
            "min_growth": 0.10,
            "industries": ["46", "47"], // NACE codes if mentioned
            "custom_sql_conditions": ["c.city = 'Stockholm'", "c.company_name LIKE '%Tech%'"],
            "explanation": "I've filtered for Tech companies in Stockholm with >10M revenue.",
            "suggestions": [
                "Would you like to focus on companies with >20 employees?",
                "Should we filter for high growth (>20% YoY)?",
                "Do you want to limit the search to the Stockholm region?"
            ]
        }
        
        Rules:
        - Revenue is in SEK. "100m" usually means 100 million SEK.
        - Margins/Growth are decimals (0.1 = 10%).
        - Use custom_sql_conditions for things like location, name matching, or specific exclusions.
        - Use column names: companies c has company_name, city, country, nace_codes (json); company_metrics m has the financial fields. Never use c.name.
        - Be smart about "profitable" (margin > 0) or "high growth" (growth > 0.2).
        - For wildcards in SQL LIKE, you may use %; the system will adapt for Postgres.
        """
        if nivo_thesis_block:
            system_prompt = system_prompt.rstrip() + "\n\n" + nivo_thesis_block.strip()
        
        if self.client is None:
            raise ValueError(
                "Sourcing assistant is not configured: set OPENAI_API_KEY (or LLM_API_KEY) in the "
                "project .env, or set LLM_BASE_URL to a local OpenAI-compatible server. "
                "See .env.example in the repository root."
            )
        
        # Build context from current criteria if exists
        context = ""
        if current_criteria:
            context = (
                "Current structured filters (merge or reset when the user changes intent): "
                f"min_revenue={current_criteria.min_revenue}, "
                f"min_ebitda_margin={current_criteria.min_ebitda_margin}, "
                f"min_growth={current_criteria.min_growth}, "
                f"industries={current_criteria.industries}, "
                f"custom_sql_conditions={current_criteria.custom_sql_conditions}"
            )

        msg_list: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for m in history_messages or []:
            role = m.get("role")
            content = m.get("content")
            if role in ("user", "assistant") and isinstance(content, str) and content.strip():
                msg_list.append({"role": role, "content": content.strip()})
        msg_list.append({"role": "user", "content": f"{context}\nUser Request: {prompt}"})

        create_kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": msg_list,
            "temperature": 0.0,
        }
        if (os.getenv("LLM_RESPONSE_JSON_OBJECT", "true") or "true").lower() in (
            "1",
            "true",
            "yes",
        ):
            create_kwargs["response_format"] = {"type": "json_object"}
        try:
            response = self.client.chat.completions.create(**create_kwargs)
        except Exception as e:
            logger.error("LLM call failed: %s", e, exc_info=True)
            raise RuntimeError(
                f"The LLM could not process your request ({type(e).__name__}). "
                f"Check OPENAI_API_KEY / LLM_BASE_URL, model name ({self.model}), and network. Detail: {e}"
            ) from e

        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            raise RuntimeError("The LLM returned an empty response. Try again or switch OPENAI_MODEL / LLM_MODEL.")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("LLM did not return valid JSON: %s", raw[:500])
            raise RuntimeError("The LLM did not return valid filter JSON. Try rephrasing your message.") from e

        _mr = data.get("max_results", data.get("limit", 500))
        try:
            max_results = int(_mr) if _mr is not None else 500
        except (TypeError, ValueError):
            max_results = 500
        max_results = max(1, min(max_results, 50_000))

        crit = FilterCriteria(
            min_revenue=data.get("min_revenue", 0),
            min_ebitda_margin=data.get("min_ebitda_margin", -1.0),
            min_growth=data.get("min_growth", -1.0),
            industries=data.get("industries"),
            max_results=max_results,
            custom_sql_conditions=data.get("custom_sql_conditions", []),
            description=data.get("explanation", "Updated filters based on request."),
            suggestions=data.get("suggestions", []),
        )
        _augment_criteria_for_company_name_prompt(prompt, crit)
        return crit

class FinancialFilter:
    """Filters companies based on financial metrics"""
    
    def __init__(self):
        self.db = get_database_service()

    def _metrics_join_clause(self, criteria: FilterCriteria) -> str:
        """
        Use LEFT JOIN when custom SQL touches row-level company attributes (name, city, …)
        so companies without a KPI row still match. Keep INNER JOIN for pure financial / NACE
        universe queries so an unrestricted filter does not scan the full companies table.
        """
        has_custom = any((c or "").strip() for c in criteria.custom_sql_conditions or [])
        return (
            "LEFT JOIN company_metrics m ON m.orgnr = c.orgnr"
            if has_custom
            else "JOIN company_metrics m ON m.orgnr = c.orgnr"
        )
    
    def _build_where_clause(self, criteria: FilterCriteria) -> str:
        """Build SQL WHERE clause from criteria"""
        is_sqlite = self.db.__class__.__name__ == "LocalDBService"
        where_parts = ["1=1"]
        
        if criteria.min_revenue > 0:
            where_parts.append(f"m.latest_revenue_sek >= {criteria.min_revenue}")
            
        if criteria.min_ebitda_margin > -1.0:
            where_parts.append(f"m.avg_ebitda_margin >= {criteria.min_ebitda_margin}")
            
        if criteria.min_growth > -1.0:
            where_parts.append(f"m.revenue_cagr_3y >= {criteria.min_growth}")
        
        if criteria.industries:
            if is_sqlite:
                # SQLite doesn't support array operators, use LIKE as a fallback for JSON strings
                or_conditions = []
                for code in criteria.industries:
                    or_conditions.append(f"c.nace_codes LIKE '%\"{code}\"%'")
                if or_conditions:
                    where_parts.append(f"({' OR '.join(or_conditions)})")
            else:
                # Postgres: jsonb ?| right operand is text[] (must not use bare "?" — see
                # postgres_db_service _sqlite_to_psycopg). ARRAY['a','b'] not ARRAY{a,b}.
                quoted = ", ".join(
                    "'" + str(code).replace("'", "''") + "'" for code in (criteria.industries or [])
                )
                where_parts.append(
                    f"c.nace_codes::jsonb ?| ARRAY[{quoted}]::text[]"
                )
            
        # Add custom SQL conditions from LLM
        if criteria.custom_sql_conditions:
            for condition in criteria.custom_sql_conditions:
                c = (condition or "").strip()
                # Basic sanitization; Postgres/psycopg2 treats % as special — double for LIKE '%%'
                if not c or ";" in c or "--" in c:
                    continue
                if not is_sqlite:
                    c = c.replace("%", "%%")
                where_parts.append(c)
        
        return " AND ".join(where_parts)

    def filter(self, criteria: FilterCriteria) -> List[str]:
        """Filter companies and return list of orgnr"""
        where_clause = self._build_where_clause(criteria)
        join_metrics = self._metrics_join_clause(criteria)

        sql = f"""
        SELECT c.orgnr
        FROM companies c
        {join_metrics}
        WHERE {where_clause}
        ORDER BY m.latest_revenue_sek DESC NULLS LAST, m.revenue_cagr_3y DESC NULLS LAST, c.company_name ASC
        LIMIT {criteria.max_results}
        """
        
        logger.debug(f"Executing SQL: {sql}")
        
        try:
            rows = self.db.run_raw_query(sql)
            return [row["orgnr"] for row in rows]
        except Exception as e:
            logger.error(f"Failed to execute filter query: {e}")
            raise
    
    def get_filter_stats(self, criteria: FilterCriteria) -> dict:
        """
        Get statistics about the filter results without running the full query
        
        Returns:
            Dictionary with count and sample companies
        """
        where_clause = self._build_where_clause(criteria)
        join_metrics = self._metrics_join_clause(criteria)

        count_sql = f"""
        SELECT COUNT(*) as total
        FROM companies c
        {join_metrics}
        WHERE {where_clause}
        """
        
        try:
            result = self.db.run_raw_query(count_sql)
            total = result[0]["total"] if result else 0
            
            return {
                "total_matches": total,
                "will_return": min(total, criteria.max_results),
                "criteria": {
                    "min_revenue": criteria.min_revenue,
                    "min_ebitda_margin": criteria.min_ebitda_margin,
                    "min_growth": criteria.min_growth,
                    "industries": criteria.industries,
                }
            }
        except Exception as e:
            logger.error(f"Failed to get filter stats: {e}")
            raise
