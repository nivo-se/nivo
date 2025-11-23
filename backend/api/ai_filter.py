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
    SELECT f1.orgnr, 
           COALESCE(f1.si_sek, f1.sdi_sek) as latest_revenue_sek
    FROM financials f1
    INNER JOIN (
        SELECT orgnr, MAX(year) as latest_year
        FROM financials
        WHERE currency = 'SEK' 
          AND (period = '12' OR period LIKE '%-12')
          AND year >= 2020
          AND (si_sek IS NOT NULL OR sdi_sek IS NOT NULL)
        GROUP BY orgnr
    ) f2 ON f1.orgnr = f2.orgnr AND f1.year = f2.latest_year
    WHERE f1.currency = 'SEK' 
      AND (f1.period = '12' OR f1.period LIKE '%-12')
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
    SELECT f1.orgnr, 
           COALESCE(f1.si_sek, f1.sdi_sek) as latest_revenue_sek
    FROM financials f1
    INNER JOIN (
        SELECT orgnr, MAX(year) as latest_year
        FROM financials
        WHERE currency = 'SEK' 
          AND (period = '12' OR period LIKE '%-12')
          AND year >= 2020
          AND (si_sek IS NOT NULL OR sdi_sek IS NOT NULL)
        GROUP BY orgnr
    ) f2 ON f1.orgnr = f2.orgnr AND f1.year = f2.latest_year
    WHERE f1.currency = 'SEK' 
      AND (f1.period = '12' OR f1.period LIKE '%-12')
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
    # Look for patterns like "100M", "100 million", ">100M", "over 100M", "around 100M"
    revenue_match = re.search(r'(\d+)\s*(?:million|m|msek|m sek)', prompt_lower)
    if revenue_match:
        millions = int(revenue_match.group(1))
        min_revenue = millions * 1_000_000
        if 'around' in prompt_lower or '~' in prompt_lower or 'approximately' in prompt_lower:
            # Range: ±20% (80M-120M for 100M)
            lower_bound = int(min_revenue * 0.8)
            upper_bound = int(min_revenue * 1.2)
            clause_parts.append(f"f.latest_revenue_sek >= {lower_bound} AND f.latest_revenue_sek <= {upper_bound}")
        elif '>' in prompt_lower or 'over' in prompt_lower or 'above' in prompt_lower:
            clause_parts.append(f"f.latest_revenue_sek >= {min_revenue}")
        elif '<' in prompt_lower or 'under' in prompt_lower or 'below' in prompt_lower:
            clause_parts.append(f"f.latest_revenue_sek <= {min_revenue}")
        else:
            clause_parts.append(f"f.latest_revenue_sek >= {min_revenue}")
    
    # Parse margin requirements
    if 'healthy margin' in prompt_lower or 'good margin' in prompt_lower:
        clause_parts.append("(k.avg_ebitda_margin >= 0.10 OR k.avg_net_margin >= 0.05)")
    if 'improvement potential' in prompt_lower or 'upside' in prompt_lower:
        clause_parts.append("(k.avg_ebitda_margin < 0.20 AND k.avg_ebitda_margin > 0)")
    
    return " AND ".join(clause_parts)


def _call_openai_for_where_clause(prompt: str) -> Optional[str]:
    """
    Use OpenAI LLM to intelligently analyze the investor thesis and generate SQL WHERE clause.
    This is a full LLM analysis, not rule-based parsing.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set, falling back to heuristic filter")
        return None
    client = OpenAI(api_key=api_key)
    
    system_prompt = (
        "You are an expert investment analyst translating natural language investor theses into SQL WHERE clauses. "
        "Analyze the prompt carefully and generate appropriate filters based on the criteria mentioned.\n\n"
        
        "DATABASE SCHEMA:\n"
        "Tables and aliases:\n"
        "- companies (alias: c) - Company master data\n"
        "- company_kpis (alias: k) - Calculated financial metrics\n"
        "- financials subquery (alias: f) - Latest year revenue from financials table\n"
        "- ai_profiles (alias: p) - AI-analyzed company profiles (if available, LEFT JOIN)\n\n"
        
        "AVAILABLE COLUMNS:\n"
        "Financial Metrics:\n"
        "- f.latest_revenue_sek: Latest year revenue in actual SEK (e.g., 100000000 = 100M SEK)\n"
        "- k.avg_ebitda_margin: Average EBITDA margin as decimal (0.15 = 15%)\n"
        "- k.avg_net_margin: Average net margin as decimal (0.10 = 10%)\n"
        "- k.revenue_cagr_3y: 3-year revenue CAGR as decimal (0.10 = 10%)\n"
        "- k.revenue_growth_yoy: Year-over-year growth as decimal (0.05 = 5%)\n\n"
        
        "Company Attributes:\n"
        "- k.company_size_bucket: 'small', 'medium', 'large'\n"
        "- k.growth_bucket: Growth category\n"
        "- k.profitability_bucket: Profitability category\n"
        "- c.segment_names: Industry segments (comma-separated, use LIKE for filtering)\n\n"
        
        "AI Profile Data (if available via LEFT JOIN):\n"
        "- p.industry_sector: AI-classified industry sector\n"
        "- p.industry_subsector: AI-classified subsector\n"
        "- p.strategic_fit_score: AI strategic fit score (1-10)\n"
        "- p.product_description: AI-extracted product description (use LIKE for keyword matching)\n"
        "- p.business_model_summary: AI business model summary\n"
        "- p.market_regions: JSONB array of market regions\n\n"
        
        "REVENUE CONVERSION GUIDE:\n"
        "- '100 million SEK' = 100000000\n"
        "- '100M SEK' = 100000000\n"
        "- '10 million' = 10000000\n"
        "- 'around 100M' or '~100M' = range 80M-120M (±20%)\n\n"
        
        "INTERPRETATION GUIDELINES:\n"
        "- 'around X' or 'approximately X' = range of ±20% (e.g., around 100M = 80M-120M)\n"
        "- 'healthy margins' = EBITDA >= 10% OR Net >= 5%\n"
        "- 'improvement potential' = margins > 0% but < 20% (room to grow)\n"
        "- 'product offering' or 'fit strategy' = use p.product_description LIKE '%keyword%' if ai_profiles available\n"
        "- 'growth' = use k.revenue_cagr_3y or k.revenue_growth_yoy\n"
        "- Industry mentions = use c.segment_names LIKE '%keyword%' or p.industry_sector\n\n"
        
        "OUTPUT FORMAT:\n"
        "Return JSON with a single field 'where_clause' containing ONLY the WHERE clause content "
        "(without the word WHERE). Use proper SQL syntax with AND/OR operators.\n\n"
        
        "EXAMPLES:\n"
        "Input: 'Find companies with revenue over 100 million SEK'\n"
        "Output: {\"where_clause\": \"f.latest_revenue_sek >= 100000000\"}\n\n"
        
        "Input: 'around 100M turnover with healthy margins'\n"
        "Output: {\"where_clause\": \"f.latest_revenue_sek >= 80000000 AND f.latest_revenue_sek <= 120000000 AND (k.avg_ebitda_margin >= 0.10 OR k.avg_net_margin >= 0.05)\"}\n\n"
        
        "Input: 'companies that fit Nivo acquisition strategy with product offerings'\n"
        "Output: {\"where_clause\": \"p.product_description IS NOT NULL AND (p.strategic_fit_score >= 7 OR p.product_description LIKE '%platform%' OR p.product_description LIKE '%software%')\"}\n\n"
        
        "IMPORTANT:\n"
        "- Always use f.latest_revenue_sek for revenue (not k.latest_revenue_sek)\n"
        "- For ai_profiles columns, use LEFT JOIN so companies without profiles are still included\n"
        "- Be intelligent about interpreting vague criteria (e.g., 'fit strategy' = look for product keywords or strategic fit score)\n"
        "- Combine multiple criteria with AND when all must be met\n"
    )
    
    user_prompt = (
        f"Investor thesis: {prompt}\n\n"
        "Analyze this thesis and generate a SQL WHERE clause that filters companies matching the criteria. "
        "Consider all aspects mentioned: revenue, margins, growth, industry, product offerings, strategic fit, etc. "
        "If the prompt mentions product offerings or strategic fit, use ai_profiles data if available.\n\n"
        "Return JSON with field 'where_clause'."
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


def _needs_ai_profiles_filter(prompt: str) -> bool:
    """Check if the prompt requires ai_profiles data (product offerings, strategic fit, etc.)"""
    prompt_lower = prompt.lower()
    keywords = [
        "product", "offering", "service", "solution",
        "strategic fit", "fit strategy", "acquisition strategy",
        "business model", "industry", "sector",
        "market", "customer", "client"
    ]
    return any(keyword in prompt_lower for keyword in keywords)


def _filter_by_ai_profiles(
    org_numbers: List[str],
    prompt: str,
    supabase,
    db
) -> List[str]:
    """
    Post-filter companies using ai_profiles data (Supabase or local SQLite).
    This handles criteria that can't be filtered via SQL (product offerings, strategic fit, etc.).
    """
    if not org_numbers:
        return []
    
    profiles_map: Dict[str, Dict[str, Any]] = {}
    
    # Try Supabase first
    if supabase:
        try:
            profile_response = (
                supabase.table("ai_profiles")
                .select("org_number, product_description, strategic_fit_score, industry_sector, business_model_summary")
                .in_("org_number", org_numbers)
                .execute()
            )
            if profile_response.data:
                for profile in profile_response.data:
                    profiles_map[profile["org_number"]] = profile
        except Exception as exc:
            logger.debug("Failed to fetch ai_profiles from Supabase: %s", exc)
    
    # Also check local SQLite (fallback)
    try:
        check_table = db.run_raw_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_profiles'"
        )
        if check_table:
            placeholders = ",".join("?" * len(org_numbers))
            local_profiles = db.run_raw_query(
                f"""
                SELECT org_number, product_description, strategic_fit_score, industry_sector, business_model_summary
                FROM ai_profiles
                WHERE org_number IN ({placeholders})
                """,
                org_numbers
            )
            for profile in local_profiles:
                orgnr = profile.get("org_number")
                if orgnr and orgnr not in profiles_map:
                    profiles_map[orgnr] = {
                        "org_number": orgnr,
                        "product_description": profile.get("product_description"),
                        "strategic_fit_score": profile.get("strategic_fit_score"),
                        "industry_sector": profile.get("industry_sector"),
                        "business_model_summary": profile.get("business_model_summary"),
                    }
    except Exception as local_exc:
        logger.debug("Failed to fetch ai_profiles from local SQLite: %s", local_exc)
    
    if not profiles_map:
        # No profiles available - return all (can't filter on missing data)
        logger.info("No ai_profiles found for filtering, returning all companies")
        return org_numbers
    
    # Use LLM to determine which companies match based on ai_profiles
    # For now, if prompt mentions product/strategy, filter to companies with profiles
    # In future, could use LLM to score each company's profile against the prompt
    prompt_lower = prompt.lower()
    
    if "product" in prompt_lower or "offering" in prompt_lower or "fit strategy" in prompt_lower:
        # Filter to companies that have been enriched (have profiles)
        filtered = [org for org in org_numbers if org in profiles_map]
        logger.info("Filtered %s companies to %s with ai_profiles", len(org_numbers), len(filtered))
        return filtered if filtered else org_numbers  # Return all if none match
    
    # For other criteria, return all (ai_profiles filtering not needed)
    return org_numbers


@router.post("/", response_model=AIFilterResponse)
async def run_ai_filter(payload: AIFilterRequest) -> AIFilterResponse:
    """
    AI-powered company filtering using full LLM analysis.
    
    Process:
    1. Use OpenAI to analyze prompt and generate SQL WHERE clause
    2. Execute SQL query on local database (financials + KPIs)
    3. If prompt mentions product/strategy, post-filter using ai_profiles from Supabase
    4. Return matching company org numbers
    """
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
    
    # Post-filter using ai_profiles if prompt requires it
    if _needs_ai_profiles_filter(payload.prompt):
        org_numbers = _filter_by_ai_profiles(org_numbers, payload.prompt, supabase, db)
        result_count = len(org_numbers)
        # Update total_matches if we filtered (approximate - could recalculate if needed)
        if result_count < len([row["orgnr"] for row in rows]):
            total_matches = result_count  # Approximate after filtering
    
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
        "used_ai_profiles": _needs_ai_profiles_filter(payload.prompt),
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

