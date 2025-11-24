from __future__ import annotations

import logging
import os
import time
from pathlib import Path
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
LEFT JOIN company_metrics m ON m.orgnr = c.orgnr
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
ORDER BY COALESCE(m.revenue_cagr_3y, 0) DESC, c.company_name ASC
LIMIT ? OFFSET ?
"""

COUNT_SQL = """
SELECT COUNT(DISTINCT c.orgnr) as total_matches
FROM companies c
LEFT JOIN company_metrics m ON m.orgnr = c.orgnr
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
    current_where_clause: Optional[str] = Field(None, description="Existing SQL WHERE clause to refine")


def _call_openai_for_where_clause(prompt: str, current_where_clause: Optional[str] = None) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set, falling back to heuristic filter")
        return {}
    client = OpenAI(api_key=api_key)
    # Load RAG context dynamically
    try:
        from backend.utils.retrieve_context import retrieve_context
        rag_context = retrieve_context(prompt)
    except Exception as e:
        logger.error(f"Failed to load RAG context: {e}")
        rag_context = "You are a financial sourcing assistant."

    system_prompt = (
        f"{rag_context}\n\n"
        "IMPORTANT: Return JSON with:\n"
        "- where_clause: The SQL WHERE clause (without the word WHERE).\n"
        "- explanation: Brief explanation of why these filters were applied (1 sentence).\n"
        "- suggestions: List of 2-3 short follow-up questions to help the user refine the search.\n"
        "Example output:\n"
        "{'where_clause': 'f.max_revenue_sek >= 100000000', 'explanation': 'Filtered for companies with >100M SEK revenue.', 'suggestions': ['Should we filter by profitability?', 'Focus on specific regions?']}"
    )
    
    if current_where_clause:
        user_prompt = (
            f"Current active filter: {current_where_clause}\n"
            f"User refinement: {prompt}\n"
            "Task: Update the WHERE clause to incorporate the user's refinement. Keep existing filters unless the user explicitly asks to remove or change them.\n"
            "Return JSON with fields where_clause, explanation, suggestions."
        )
    else:
        user_prompt = (
            f"Investor thesis: {prompt}\n"
            "Return JSON with fields where_clause, explanation, suggestions."
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
            return {}
    except Exception as exc:
        logger.error("OpenAI API error: %s", exc)
        return {}
    
    import json
    try:
        data = json.loads(content)
        return data
    except Exception as exc:
        logger.error("Failed to parse OpenAI response JSON: %s", exc)
        return {}


@router.post("/", response_model=AIFilterResponse)
async def run_ai_filter(payload: AIFilterRequest) -> AIFilterResponse:
    db = get_database_service()
    supabase = get_supabase_client()

    used_llm = False
    llm_result = _call_openai_for_where_clause(payload.prompt, payload.current_where_clause)
    clause = llm_result.get("where_clause")
    explanation = llm_result.get("explanation")
    suggestions = llm_result.get("suggestions", [])

    if clause:
        used_llm = True
    else:
        clause = _fallback_where_clause(payload.prompt)
        explanation = "Used heuristic keyword matching."
        suggestions = []

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
        explanation=explanation,
        suggestions=suggestions
    )

