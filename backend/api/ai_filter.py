from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field

from .dependencies import get_supabase_client
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-filter", tags=["ai-filter"])

BASE_SQL = """
SELECT DISTINCT c.orgnr
FROM companies c
LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
LEFT JOIN (
    SELECT orgnr, MAX(si_sek) as max_revenue_sek
    FROM financials
    WHERE currency = 'SEK' 
      AND (period = '12' OR period LIKE '%-12')
      AND year >= 2020
      AND si_sek IS NOT NULL
    GROUP BY orgnr
) f ON f.orgnr = c.orgnr
WHERE {where_clause}
ORDER BY COALESCE(k.revenue_cagr_3y, 0) DESC, c.company_name ASC
LIMIT ? OFFSET ?
"""

COUNT_SQL = """
SELECT COUNT(DISTINCT c.orgnr) as total_matches
FROM companies c
LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
LEFT JOIN (
    SELECT orgnr, MAX(si_sek) as max_revenue_sek
    FROM financials
    WHERE currency = 'SEK' 
      AND (period = '12' OR period LIKE '%-12')
      AND year >= 2020
      AND si_sek IS NOT NULL
    GROUP BY orgnr
) f ON f.orgnr = c.orgnr
WHERE {where_clause}
"""

SAFE_KEYWORDS = ("select", "where", "and", "or", "not", "between", "like", "in")


class AIFilterRequest(BaseModel):
    prompt: str = Field(..., description="Natural language description of the acquisition target")
    limit: int = Field(50, ge=1, le=200)
    offset: int = Field(0, ge=0)


class AIFilterResponse(BaseModel):
    sql: str
    parsed_where_clause: str
    org_numbers: List[str]
    count: int
    result_count: int
    total: int
    metadata: Dict[str, Any]


def _sanitize_where_clause(clause: str) -> str:
    lowered = clause.lower()
    disallowed = ("insert", "update", "delete", "drop", ";", "--", "alter", "create")
    if any(keyword in lowered for keyword in disallowed):
        raise ValueError("LLM produced unsafe SQL. Please refine the prompt.")
    return clause


def _fallback_where_clause(prompt: str) -> str:
    # Simple heuristic parser when OpenAI is unavailable
    clause_parts = ["1=1"]
    prompt_lower = prompt.lower()
    if "sweden" in prompt_lower or "swedish" in prompt_lower:
        clause_parts.append("c.country = 'SE'")
    if "logistics" in prompt_lower:
        clause_parts.append("c.segment_names LIKE '%logistik%'")
    if "profitable" in prompt_lower:
        clause_parts.append("COALESCE(k.avg_net_margin, 0) > 0.05")
    
    # Parse revenue requirements (100M = 100000000, 10M = 10000000, etc.)
    import re
    # Look for patterns like "100M", "100 million", ">100M", "over 100M"
    revenue_match = re.search(r'(\d+)\s*(?:million|m|msek|m sek)', prompt_lower)
    if revenue_match:
        millions = int(revenue_match.group(1))
        min_revenue = millions * 1_000_000
        if '>' in prompt_lower or 'over' in prompt_lower or 'above' in prompt_lower:
            clause_parts.append(f"f.max_revenue_sek >= {min_revenue}")
        elif '<' in prompt_lower or 'under' in prompt_lower or 'below' in prompt_lower:
            clause_parts.append(f"f.max_revenue_sek <= {min_revenue}")
        else:
            clause_parts.append(f"f.max_revenue_sek >= {min_revenue}")
    
    return " AND ".join(clause_parts)


def _call_openai_for_where_clause(prompt: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set, falling back to heuristic filter")
        return None
    client = OpenAI(api_key=api_key)
    system_prompt = (
        "You translate investor theses into SQL WHERE clauses for SQLite. "
        "Use columns from tables companies (alias c), company_kpis (alias k), and financials subquery (alias f). "
        "CRITICAL: For revenue filtering, use f.max_revenue_sek (from financials table, actual SEK). "
        "Revenue conversion: '100 million SEK' = 100000000, '100M SEK' = 100000000, '10 million' = 10000000. "
        "When user asks for revenue >100M or >100 million, use: f.max_revenue_sek >= 100000000. "
        "When user asks for revenue >10M, use: f.max_revenue_sek >= 10000000. "
        "Available columns: "
        "- f.max_revenue_sek (use this for revenue filtering - actual SEK from financials) "
        "- k.avg_ebitda_margin (decimal 0.15 = 15%), k.avg_net_margin "
        "- k.revenue_cagr_3y (decimal 0.10 = 10%), k.revenue_growth_yoy "
        "- k.company_size_bucket ('small', 'medium', 'large') "
        "- k.growth_bucket, k.profitability_bucket "
        "- c.segment_names (for industry filtering) "
        "Return ONLY the WHERE clause content (without the word WHERE). "
        "Example: For 'revenue over 100 million SEK', return: f.max_revenue_sek >= 100000000"
    )
    user_prompt = (
        f"Investor thesis: {prompt}\n"
        "Return JSON with field where_clause."
    )
    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            return None
    except Exception as exc:
        logger.error("OpenAI API error: %s", exc)
        return None
    
    import json
    try:
        data = json.loads(content)
        clause = data.get("where_clause")
    except Exception as exc:
        logger.error("Failed to parse OpenAI response JSON: %s", exc)
        return None
    if not clause:
        return None
    return clause


@router.post("/", response_model=AIFilterResponse)
async def run_ai_filter(payload: AIFilterRequest) -> AIFilterResponse:
    db = get_database_service()
    supabase = get_supabase_client()

    used_llm = False
    clause = _call_openai_for_where_clause(payload.prompt)
    if clause:
        used_llm = True
    else:
        clause = _fallback_where_clause(payload.prompt)
    try:
        clause = _sanitize_where_clause(clause)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sql = BASE_SQL.format(where_clause=clause or "1=1")
    count_sql = COUNT_SQL.format(where_clause=clause or "1=1")
    params: List[Any] = [payload.limit, payload.offset]
    started = time.perf_counter()
    try:
        rows = db.run_raw_query(sql, params=params)
        total_row = db.run_raw_query(count_sql)
        total_matches = total_row[0]["total_matches"] if total_row else len(rows)
    except Exception as exc:
        logger.exception("Failed to execute AI filter query")
        raise HTTPException(status_code=500, detail="Failed to execute query") from exc
    duration_ms = int((time.perf_counter() - started) * 1000)
    org_numbers = [row["orgnr"] for row in rows]
    result_count = len(org_numbers)
    metadata: Dict[str, Any] = {
        "where_clause": clause,
        "limit": payload.limit,
        "offset": payload.offset,
        "prompt": payload.prompt,
        "used_llm": used_llm,
        "total_matches": total_matches,
        "result_count": result_count,
        "duration_ms": duration_ms,
        "executor": "openai" if used_llm else "heuristic",
        "sql": sql.strip(),
    }

    # Log to Supabase (best effort)
    try:
        supabase.table("ai_queries").insert(
            {
                "user_prompt": payload.prompt,
                "parsed_sql": clause,
                "result_count": len(org_numbers),
            }
        ).execute()
    except Exception as exc:  # pragma: no cover - logging only
        logger.warning("Failed to log AI query: %s", exc)

    return AIFilterResponse(
        sql=sql,
        parsed_where_clause=clause,
        org_numbers=org_numbers,
        count=result_count,
        result_count=result_count,
        total=total_matches,
        metadata=metadata,
    )

