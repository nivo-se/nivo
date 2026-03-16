"""Company profile research agent with LLM-driven company understanding."""

from __future__ import annotations

import re
from dataclasses import dataclass

from backend.services.web_intel.source_normalizer import is_blocked_domain

from .context import AgentContext
from .schemas import AgentClaim, CompanyProfileAgentOutput, SourceEvidence


def _joined_text_filtered(context: AgentContext, max_chars: int = 15000) -> str:
    """Build joined text excluding content from blocked domains (aggregators, registries, job boards)."""
    excluded_ids = {s.source_id for s in context.sources if s.url and is_blocked_domain(s.url)}
    chunk_text = " ".join(
        c.text for c in context.chunks
        if c.source_id not in excluded_ids and c.text
    )
    source_text = " ".join(
        s.content_text or ""
        for s in context.sources
        if s.source_id not in excluded_ids
    )
    text = f"{chunk_text} {source_text}".strip()
    return text[:max_chars]


def _sentences(text: str) -> list[str]:
    bits = re.split(r"(?<=[.!?])\s+", text)
    return [b.strip() for b in bits if len(b.strip()) > 20]


def _build_source_refs(context: AgentContext) -> list[dict]:
    """Build source_refs for company understanding payload."""
    refs: list[dict] = []
    for s in context.sources[:10]:
        refs.append({
            "source_id": str(s.source_id) if s.source_id else None,
            "url": s.url,
            "title": s.title,
        })
    return refs


@dataclass(slots=True)
class CompanyProfileAgent:
    """Generates structured company profile from source content.

    Uses LLM-driven extraction when raw text is available and OPENAI_API_KEY is set.
    Falls back to heuristic extraction otherwise.
    """

    def run(self, context: AgentContext) -> CompanyProfileAgentOutput:
        # Exclude job aggregator sources to avoid mixing in other companies
        joined = _joined_text_filtered(context, max_chars=15000) or context.joined_text(max_chars=15000)
        company_name = context.company_name or "Company"

        # Try LLM extraction first when we have enough text
        llm_result = None
        try:
            from backend.llm.company_understanding import extract_company_understanding

            orgnr = getattr(context, "orgnr", None)
            llm_result = extract_company_understanding(company_name, joined, orgnr=orgnr)
        except Exception:
            pass

        if llm_result:
            return self._build_from_llm(llm_result, context, joined)
        return self._build_from_heuristic(context, joined)

    def _build_from_llm(
        self, llm_result: dict, context: AgentContext, joined: str
    ) -> CompanyProfileAgentOutput:
        """Build output from LLM extraction result."""
        summary = llm_result.get("company_description") or ""
        business_model = llm_result.get("business_model") or "Business model not identified."
        products = llm_result.get("products_services") or []
        if isinstance(products, str):
            products = [products]
        customers = llm_result.get("target_customers") or []
        if isinstance(customers, str):
            customers = [customers]
        geographies = llm_result.get("geographies") or []
        if isinstance(geographies, str):
            geographies = [geographies]
        market_niche = llm_result.get("market_niche") or ""
        confidence = float(llm_result.get("confidence_score", 0.5))

        if not summary and business_model:
            summary = business_model[:300]

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
                claim_text=f"Profile summary: {summary[:220]}",
                claim_type="company_profile_summary",
                confidence=confidence,
                evidence=evidence,
            ),
            AgentClaim(
                claim_text=f"Business model: {business_model[:220]}",
                claim_type="company_profile_business_model",
                confidence=confidence,
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
            metadata={
                "source_count": len(context.sources),
                "chunk_count": len(context.chunks),
                "extraction_method": "llm",
            },
            company_description=summary or None,
            market_niche=market_niche or None,
            confidence_score=confidence,
            source_refs=_build_source_refs(context),
        )

    def _build_from_heuristic(self, context: AgentContext, joined: str) -> CompanyProfileAgentOutput:
        """Build output from heuristic extraction (fallback)."""
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

        # Infer market_niche from products or business model
        market_niche = products[0][:100] if products else (business_model[:80] if business_model else None)

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
            metadata={
                "source_count": len(context.sources),
                "chunk_count": len(context.chunks),
                "extraction_method": "heuristic",
            },
            company_description=summary or None,
            market_niche=market_niche,
            confidence_score=0.6 if sentences else 0.35,
            source_refs=_build_source_refs(context),
        )
