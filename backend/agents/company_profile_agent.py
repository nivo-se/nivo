"""Company profile research agent."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, CompanyProfileAgentOutput, SourceEvidence


def _sentences(text: str) -> list[str]:
    bits = re.split(r"(?<=[.!?])\s+", text)
    return [b.strip() for b in bits if len(b.strip()) > 20]


@dataclass(slots=True)
class CompanyProfileAgent:
    """Generates structured company profile from source content."""

    def run(self, context: AgentContext) -> CompanyProfileAgentOutput:
        joined = context.joined_text(max_chars=15000)
        sentences = _sentences(joined)

        summary = (
            " ".join(sentences[:2])
            if sentences
            else "Insufficient source content for profile summary."
        )

        business_candidates = [
            s
            for s in sentences
            if any(k in s.lower() for k in ["provides", "offers", "develops", "specializes"])
        ]
        business_model = business_candidates[0] if business_candidates else (
            sentences[0] if sentences else "Business model not identified from sources."
        )

        product_keywords = [
            "software",
            "platform",
            "service",
            "services",
            "product",
            "products",
            "solution",
            "solutions",
            "consulting",
        ]
        products: list[str] = []
        for s in sentences[:12]:
            lower = s.lower()
            if any(k in lower for k in product_keywords):
                products.append(s[:180])
            if len(products) >= 5:
                break

        customers: list[str] = []
        if "b2b" in joined.lower():
            customers.append("B2B customers")
        if "b2c" in joined.lower():
            customers.append("B2C customers")
        if any(w in joined.lower() for w in ["enterprise", "corporate"]):
            customers.append("Enterprise customers")
        if not customers and sentences:
            customers.append("Customer segment not explicitly specified")

        geographies: list[str] = []
        for geo in ["Sweden", "Nordics", "Europe", "Global"]:
            if geo.lower() in joined.lower():
                geographies.append(geo)
        if not geographies:
            geographies.append("Geography not explicitly stated")

        primary_source = context.primary_source()
        primary_chunk = context.primary_chunk()
        evidence = SourceEvidence(
            source_id=primary_source.source_id if primary_source else None,
            source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
            source_url=primary_source.url if primary_source else None,
            source_title=primary_source.title if primary_source else None,
            excerpt=primary_chunk.text[:280] if primary_chunk else None,
        )

        claims = [
            AgentClaim(
                claim_text=f"Profile summary indicates: {summary[:220]}",
                claim_type="company_profile_summary",
                confidence=0.65 if sentences else 0.3,
                evidence=evidence,
            ),
            AgentClaim(
                claim_text=f"Business model appears to be: {business_model[:220]}",
                claim_type="company_profile_business_model",
                confidence=0.6 if business_candidates else 0.45,
                evidence=evidence,
            ),
        ]

        return CompanyProfileAgentOutput(
            summary=summary,
            business_model=business_model,
            products_services=products,
            customer_segments=customers,
            geographies=geographies,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={"source_count": len(context.sources), "chunk_count": len(context.chunks)},
        )

