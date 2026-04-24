"""
Stage 1: Financial Filtering

Filters companies based on hard financial metrics to create initial shortlist.
"""

from __future__ import annotations

import json
import logging
import os
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
        - companies (c): orgnr, company_name, description, city, country
        - company_metrics (m): latest_revenue_sek, avg_ebitda_margin (0.15=15%), revenue_cagr_3y (0.10=10%), employees_latest
        
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
            context = f"Current Criteria: Revenue>{current_criteria.min_revenue}, Margin>{current_criteria.min_ebitda_margin}, Growth>{current_criteria.min_growth}"

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

        return FilterCriteria(
            min_revenue=data.get("min_revenue", 0),
            min_ebitda_margin=data.get("min_ebitda_margin", -1.0),
            min_growth=data.get("min_growth", -1.0),
            industries=data.get("industries"),
            max_results=max_results,
            custom_sql_conditions=data.get("custom_sql_conditions", []),
            description=data.get("explanation", "Updated filters based on request."),
            suggestions=data.get("suggestions", [])
        )

class FinancialFilter:
    """Filters companies based on financial metrics"""
    
    def __init__(self):
        self.db = get_database_service()
    
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
        
        sql = f"""
        SELECT c.orgnr
        FROM companies c
        JOIN company_metrics m ON m.orgnr = c.orgnr
        WHERE {where_clause}
        ORDER BY m.revenue_cagr_3y DESC, m.latest_revenue_sek DESC
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
        
        count_sql = f"""
        SELECT COUNT(*) as total
        FROM companies c
        JOIN company_metrics m ON m.orgnr = c.orgnr
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
