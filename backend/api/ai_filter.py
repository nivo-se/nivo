from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request
from openai import OpenAI
from pydantic import BaseModel, Field

from .dependencies import get_supabase_client, get_current_user_id
from .ai_credits import can_use_ai, record_usage, AI_FILTER_ESTIMATED_COST_USD
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

EXCLUDED_TYPES = [
    "real estate/property",
    "funds/investment companies",
    "consulting firms",
]

EXCLUSION_SQL = """
NOT (
    (LOWER(c.company_name) LIKE '%fastigheter%' OR LOWER(c.company_name) LIKE '%property%' OR c.nace_categories LIKE '%fastighet%')
    OR (LOWER(c.company_name) LIKE '%invest%' OR LOWER(c.company_name) LIKE '%fund%' OR LOWER(c.company_name) LIKE '%capital%' OR c.nace_categories LIKE '%fond%' OR c.nace_categories LIKE '%holding%')
    OR (LOWER(c.company_name) LIKE '%konsult%' OR c.nace_categories LIKE '%consult%')
)
"""


class AIFilterRequest(BaseModel):
    prompt: str = Field(..., description="Natural language description of the acquisition target")
    limit: int = Field(50, ge=1, le=200)
    offset: int = Field(0, ge=0)
    current_where_clause: Optional[str] = Field(None, description="Existing SQL WHERE clause to refine")


class AIFilterResponse(BaseModel):
    sql: str
    parsed_where_clause: str
    org_numbers: List[str]
    count: int
    result_count: int
    total: int
    metadata: Dict[str, Any]
    explanation: Optional[str] = None
    suggestions: List[str] = []
    capped: bool = False
    refinement_message: Optional[str] = None
    excluded_types: List[str] = []


def _sanitize_where_clause(clause: str) -> str:
    lowered = clause.lower()
    disallowed = ("insert", "update", "delete", "drop", ";", "--", "alter", "create")
    if any(keyword in lowered for keyword in disallowed):
        raise ValueError("LLM produced unsafe SQL. Please refine the prompt.")
    return clause


def _apply_automatic_exclusions(clause: str) -> str:
    """
    Ensure the WHERE clause always excludes disqualified company types.
    """
    base_clause = clause.strip() or "1=1"
    exclusion = EXCLUSION_SQL.strip()
    return f"({base_clause}) AND {exclusion}"


def _fallback_where_clause(prompt: str) -> str:
    # Simple heuristic parser when OpenAI is unavailable
    clause_parts = ["1=1"]
    prompt_lower = prompt.lower()
    if "sweden" in prompt_lower or "swedish" in prompt_lower:
        clause_parts.append("c.country = 'SE'")
    if "logistics" in prompt_lower:
        clause_parts.append("c.segment_names LIKE '%logistik%'")
    if "profitable" in prompt_lower:
        clause_parts.append("COALESCE(k.avg_net_margin, 0) > 5.0")
    
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
        "TASK: Generate a SQL WHERE clause from the user's natural language prompt.\n\n"
        "CRITICAL RULES:\n"
        "1. Use ONLY the columns listed in the 'Valid Fields' section above. Do NOT invent new columns.\n"
        "2. ALWAYS apply automatic exclusions (real estate, investment funds, consulting) as specified in the context.\n"
        "3. Keep filters additive unless the user explicitly requests removal.\n"
        "4. Follow the example prompts in the context for correct SQL patterns.\n\n"
        "OUTPUT FORMAT (JSON):\n"
        "- where_clause: SQL WHERE clause (without the word WHERE). Use valid columns from the schema.\n"
        "- explanation: Brief explanation (1 sentence) including automatic exclusions applied.\n"
        "- suggestions: 2-3 short follow-up questions to help refine the search.\n\n"
        "Example:\n"
        "{'where_clause': 'f.max_revenue_sek >= 100000000 AND k.avg_net_margin > 5.0', "
        "'explanation': 'Filtered for companies with >100M SEK revenue and profitable margins (excluded real estate/investment/consulting per policy).', "
        "'suggestions': ['Should we filter by growth rate?', 'Focus on specific industries?']}"
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
async def run_ai_filter(payload: AIFilterRequest, request: Request) -> AIFilterResponse:
    db = get_database_service()
    supabase = get_supabase_client()
    user_id = get_current_user_id(request)

    # Enforce AI credits limit before calling LLM
    allowed, msg = can_use_ai(user_id, AI_FILTER_ESTIMATED_COST_USD)
    if not allowed:
        raise HTTPException(status_code=402, detail=msg)

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
    clause = _apply_automatic_exclusions(clause)
    exclusion_message = (
        "Automatically excluded real estate/property, investment/fund, and consulting firms."
    )
    if explanation:
        explanation = f"{explanation} {exclusion_message}"
    else:
        explanation = exclusion_message

    # Ensure clause is valid SQL
    clause = clause or "1=1"
    # Remove any trailing semicolons or invalid characters
    clause = clause.strip().rstrip(';')
    
    sql = BASE_SQL.format(where_clause=clause)
    count_sql = COUNT_SQL.format(where_clause=clause)
    params: List[Any] = [payload.limit, payload.offset]
    started = time.perf_counter()
    try:
        rows = db.run_raw_query(sql, params=params)
        total_row = db.run_raw_query(count_sql)
        total_matches = total_row[0]["total_matches"] if total_row else len(rows)
    except Exception as exc:
        logger.exception("Failed to execute AI filter query")
        logger.error(f"SQL that failed: {sql}")
        logger.error(f"Params: {params}")
        logger.error(f"Where clause: {clause}")
        raise HTTPException(status_code=500, detail=f"Failed to execute query: {str(exc)}") from exc
    duration_ms = int((time.perf_counter() - started) * 1000)
    org_numbers = [row["orgnr"] for row in rows]
    result_count = len(org_numbers)
    capped = total_matches > 300
    refinement_message = None
    if capped:
        refinement_message = (
            f"Found {total_matches} matching companies. Refine your prompt to 300 or fewer results."
        )
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
        "excluded_types": EXCLUDED_TYPES,
        "capped": capped,
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

    # Record AI credits usage when LLM was used
    if used_llm:
        record_usage(user_id or "unknown-user", AI_FILTER_ESTIMATED_COST_USD, "ai_filter", None)

    return AIFilterResponse(
        sql=sql,
        parsed_where_clause=clause,
        org_numbers=org_numbers,
        count=result_count,
        result_count=result_count,
        total=total_matches,
        metadata=metadata,
        explanation=explanation,
        suggestions=suggestions,
        capped=capped,
        refinement_message=refinement_message,
        excluded_types=EXCLUDED_TYPES,
    )

