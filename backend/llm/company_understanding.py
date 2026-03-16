"""LLM-driven company understanding extraction for Deep Research.

Uses OpenAI to interpret messy company text and produce structured JSON
per FINAL_DEEP_RESEARCH_ARCHITECTURE.md Layer 3.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.config import get_settings
from backend.llm.payload_contracts import (
    MODEL_SELECTION,
    MAX_TOKENS_PER_STAGE,
    RETRY_BUDGET,
    validate_llm_payload,
)

logger = logging.getLogger(__name__)

COMPANY_UNDERSTANDING_SCHEMA = {
    "type": "object",
    "properties": {
        "company_description": {"type": "string", "description": "Brief description of what the company does"},
        "products_services": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of products or services the company offers",
        },
        "business_model": {"type": "string", "description": "How the company makes money"},
        "target_customers": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Who the company sells to (B2B, B2C, enterprise, etc.)",
        },
        "geographies": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Geographic markets (Sweden, Nordics, Europe, Global)",
        },
        "market_niche": {
            "type": "string",
            "description": "Target market or niche hypothesis (e.g. professional workwear, hospitality uniforms)",
        },
        "confidence_score": {
            "type": "number",
            "description": "Confidence 0-1 based on evidence quality",
        },
    },
    "required": ["company_description", "business_model", "market_niche", "confidence_score"],
}


def extract_company_understanding(
    company_name: str,
    raw_text: str,
    orgnr: str | None = None,
) -> dict[str, Any] | None:
    """Extract structured company understanding from raw text using OpenAI.

    Returns a dict with company_description, products_services, business_model,
    target_customers, geographies, market_niche, confidence_score.
    Returns None if validation fails or OpenAI is unavailable.
    """
    validation = validate_llm_payload("company_understanding", {"company_name": company_name, "raw_text": raw_text})
    if not validation.valid:
        logger.warning("Company understanding payload validation failed: %s", validation.missing_fields)
        return None

    settings = get_settings()
    if not settings.openai_api_key:
        logger.debug("OpenAI API key not configured, skipping LLM company understanding")
        return None

    text = (raw_text or "").strip()
    if len(text) < 100:
        logger.debug("Raw text too short for company understanding (%d chars)", len(text))
        return None

    model = MODEL_SELECTION.get("company_understanding", "gpt-4o-mini")
    max_tokens = MAX_TOKENS_PER_STAGE.get("company_understanding", 2000)
    retry_budget = RETRY_BUDGET.get("company_understanding", 2)

    system_prompt = """You are an analyst extracting structured company information from text.
Output valid JSON only. Be concise. Infer from context when explicit facts are missing.
confidence_score: 0.0-1.0 based on how much evidence supports each field (0.5 = partial, 0.8+ = strong).

CRITICAL: Extract information ONLY about the target company specified in the prompt. The text may contain
job listings, aggregator pages, or mentions of other companies — IGNORE all of those. Only describe
the one company the user asked about. If the text does not clearly describe the target company,
return low confidence_score (e.g. 0.2) and minimal fields."""

    disambiguate = f" (orgnr {orgnr})" if orgnr and not (orgnr or "").startswith("tmp-") else ""
    user_prompt = f"""Target company (extract information ONLY about this company): {company_name}{disambiguate}

The text below may contain multiple companies, job listings, or aggregator content. Extract structured
company understanding ONLY for "{company_name}". Ignore any other companies or organizations.

---
{text[:12000]}
---

Return JSON with: company_description, products_services (array), business_model, target_customers (array), geographies (array), market_niche, confidence_score (0-1)."""

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        formatted_schema = {
            "name": "company_understanding",
            "schema": COMPANY_UNDERSTANDING_SCHEMA,
        }

        for attempt in range(retry_budget + 1):
            try:
                response = client.chat.completions.create(
                    model=model,
                    temperature=0.2,
                    max_tokens=max_tokens,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_schema", "json_schema": formatted_schema},
                )
                content = response.choices[0].message.content if response.choices else ""
                parsed = json.loads(content or "{}")
                if parsed.get("business_model") and parsed.get("market_niche"):
                    return parsed
                logger.warning("LLM returned incomplete company understanding, attempt %d", attempt + 1)
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning("Failed to parse company understanding response (attempt %d): %s", attempt + 1, e)
        return None
    except Exception as e:
        logger.warning("OpenAI call failed for company understanding: %s", e)
        return None
