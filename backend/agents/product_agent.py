"""Product intelligence agent per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 4."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, ProductAgentOutput, SourceEvidence


def _sentences(text: str) -> list[str]:
    bits = re.split(r"(?<=[.!?])\s+", text)
    return [b.strip() for b in bits if len(b.strip()) > 15]


def _infer_pricing_position(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in ["premium", "luxury", "high-end", "exclusive"]):
        return "premium"
    if any(w in lower for w in ["budget", "low-cost", "affordable", "value"]):
        return "low"
    if any(w in lower for w in ["mid-market", "mid-range", "standard"]):
        return "mid"
    return "mid"


def _infer_brand_positioning(text: str) -> str | None:
    lower = text.lower()
    if any(w in lower for w in ["design-led", "designer", "design-focused"]):
        return "Design-led"
    if any(w in lower for w in ["quality", "craftsmanship", "handmade"]):
        return "Quality/craftsmanship"
    if any(w in lower for w in ["innovation", "technology", "digital"]):
        return "Innovation/technology"
    if any(w in lower for w in ["sustainability", "green", "eco"]):
        return "Sustainability"
    return None


@dataclass(slots=True)
class ProductAgent:
    """Extracts product portfolio, pricing, and brand positioning from sources."""

    def run(self, context: AgentContext) -> ProductAgentOutput:
        text = context.joined_text(max_chars=15000)
        company_name = context.company_name or "Company"

        product_keywords = [
            "product", "products", "service", "services", "solution", "solutions",
            "offering", "offerings", "range", "portfolio", "catalog", "line",
            "software", "platform", "consulting", "manufacturing",
        ]
        product_categories: list[str] = []
        for sent in _sentences(text)[:20]:
            lower = sent.lower()
            if any(k in lower for k in product_keywords) and len(sent) > 20:
                product_categories.append(sent[:180])
            if len(product_categories) >= 6:
                break

        pricing_position = _infer_pricing_position(text)
        brand_positioning = _infer_brand_positioning(text) or "Not explicitly stated"
        differentiators: list[str] = []
        diff_keywords = ["differentiat", "unique", "advantage", "strength", "specializ"]
        for sent in _sentences(text)[:15]:
            if any(k in sent.lower() for k in diff_keywords):
                differentiators.append(sent[:150])
            if len(differentiators) >= 4:
                break

        primary_source = context.primary_source()
        primary_chunk = context.primary_chunk()
        evidence = SourceEvidence(
            source_id=primary_source.source_id if primary_source else None,
            source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
            source_url=primary_source.url if primary_source else None,
            source_title=primary_source.title if primary_source else None,
            excerpt=primary_chunk.text[:280] if primary_chunk else None,
        )

        claims: list[AgentClaim] = []
        if product_categories:
            claims.append(
                AgentClaim(
                    claim_text=f"Product categories identified: {', '.join(product_categories[:3])}",
                    claim_type="product_portfolio",
                    confidence=0.6,
                    evidence=evidence,
                )
            )
        claims.append(
            AgentClaim(
                claim_text=f"Pricing positioning appears {pricing_position}",
                claim_type="product_pricing",
                confidence=0.55,
                evidence=evidence,
            )
        )

        source_refs = [
            {"source_id": str(s.source_id), "url": s.url, "title": s.title}
            for s in context.sources[:5]
        ]

        return ProductAgentOutput(
            product_categories=product_categories,
            pricing_position=pricing_position,
            brand_positioning=brand_positioning,
            differentiators=differentiators,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={"source_count": len(context.sources), "chunk_count": len(context.chunks)},
            sources=source_refs,
        )
