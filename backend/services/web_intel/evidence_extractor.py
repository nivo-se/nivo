"""Evidence extraction from raw retrieval results.

Converts raw content into canonical EvidenceItem with provenance.
Heuristic extraction only; no LLM.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from .source_normalizer import classify_source_type, normalize_domain

QueryGroup = Literal["company_facts", "market", "competitors", "news"]

CLAIM_TYPES: dict[str, str] = {
    "market_size": "market",
    "market_growth": "market",
    "market_trend": "market",
    "competitor_mention": "competitors",
    "company_fact": "company_facts",
    "news_development": "news",
}

MAX_SUPPORTING_TEXT = 500


@dataclass(slots=True)
class EvidenceItem:
    """Canonical evidence claim with provenance."""

    claim: str
    claim_type: str
    value: str | None
    unit: str | None
    source_url: str
    source_title: str | None
    source_domain: str
    source_type: str
    retrieved_at: str
    supporting_text: str
    confidence: float
    query_group: str
    query: str | None = None
    overall_score: float | None = None
    score_breakdown: dict | None = None
    verification_status: str | None = None


def _extract_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    if not text or not text.strip():
        return []
    bits = re.split(r"(?<=[.!?])\s+", text)
    return [b.strip() for b in bits if len(b.strip()) > 15]


def _infer_claim_type(sentence: str, query_group: str) -> str:
    """Infer claim_type from sentence content and query group."""
    lower = sentence.lower()
    if re.search(r"\d+\s*(billion|million|msek|sek|eur|usd|%)", lower):
        if "market" in lower or "size" in lower or "värd" in lower:
            return "market_size"
        if "growth" in lower or "tillväxt" in lower or "%" in lower:
            return "market_growth"
    if "competitor" in lower or "konkurrent" in lower or "jämför" in lower:
        return "competitor_mention"
    if "trend" in lower or "utveckling" in lower:
        return "market_trend"
    if query_group == "news":
        return "news_development"
    if query_group == "company_facts":
        return "company_fact"
    if query_group == "market":
        return "market_trend"
    if query_group == "competitors":
        return "competitor_mention"
    return "company_fact"


def _extract_value_unit(text: str) -> tuple[str | None, str | None]:
    """Extract numeric value and unit from text if present."""
    match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(billion|million|msek|mkr|sek|eur|usd|%|bn|m)?",
        text,
        re.IGNORECASE,
    )
    if match:
        val = match.group(1).replace(",", ".")
        unit = (match.group(2) or "").lower() or None
        if unit == "bn":
            unit = "billion"
        elif unit == "mkr":
            unit = "msek"
        return val, unit
    return None, None


def _confidence_from_specificity(value: str | None, unit: str | None) -> float:
    """Confidence 0-1: explicit number > range > qualitative."""
    if value and unit:
        return 0.85
    if value:
        return 0.7
    return 0.5


def extract_evidence(
    *,
    url: str,
    title: str | None,
    raw_content: str,
    query: str,
    query_group: QueryGroup,
    company_website: str | None = None,
) -> list[EvidenceItem]:
    """Convert raw content into EvidenceItems. Heuristic extraction."""
    domain = normalize_domain(url)
    source_type = classify_source_type(url, company_website)
    retrieved_at = datetime.now(timezone.utc).isoformat()

    if not raw_content or len(raw_content.strip()) < 50:
        return []

    sentences = _extract_sentences(raw_content[:8000])
    items: list[EvidenceItem] = []

    for sent in sentences[:20]:
        if len(sent) < 30:
            continue
        claim_type = _infer_claim_type(sent, query_group)
        value, unit = _extract_value_unit(sent)
        confidence = _confidence_from_specificity(value, unit)
        supporting = sent[:MAX_SUPPORTING_TEXT]

        items.append(
            EvidenceItem(
                claim=sent[:300],
                claim_type=claim_type,
                value=value,
                unit=unit,
                source_url=url,
                source_title=title,
                source_domain=domain,
                source_type=source_type,
                retrieved_at=retrieved_at,
                supporting_text=supporting,
                confidence=confidence,
                query_group=query_group,
                query=query,
            )
        )

    if not items:
        items.append(
            EvidenceItem(
                claim=raw_content[:300].strip(),
                claim_type="company_fact",
                value=None,
                unit=None,
                source_url=url,
                source_title=title,
                source_domain=domain,
                source_type=source_type,
                retrieved_at=retrieved_at,
                supporting_text=raw_content[:MAX_SUPPORTING_TEXT],
                confidence=0.4,
                query_group=query_group,
                query=query,
            )
        )
    return items
