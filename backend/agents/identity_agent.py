"""Identity research agent."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, IdentityAgentOutput, SourceEvidence


def _infer_industry(text: str) -> str | None:
    lowered = text.lower()
    mapping = {
        "software": ["software", "saas", "platform", "cloud"],
        "manufacturing": ["manufacturing", "factory", "industrial", "production"],
        "healthcare": ["health", "hospital", "medical", "clinic", "pharma"],
        "retail": ["retail", "store", "e-commerce", "shop"],
        "financial services": ["bank", "fintech", "insurance", "financial"],
    }
    for industry, keywords in mapping.items():
        if any(k in lowered for k in keywords):
            return industry
    return None


def _infer_headquarters(text: str) -> str | None:
    lowered = text.lower()
    cities = ["stockholm", "gothenburg", "malmo", "uppsala", "linkoping"]
    for city in cities:
        if city in lowered:
            return city.title()
    if "sweden" in lowered or "sverige" in lowered:
        return "Sweden"
    return None


@dataclass(slots=True)
class IdentityAgent:
    """Builds company identity output from available sources and chunks."""

    def run(self, context: AgentContext) -> IdentityAgentOutput:
        text = context.joined_text()
        primary_source = context.primary_source()
        primary_chunk = context.primary_chunk()

        website = context.website
        if not website and primary_source and primary_source.url:
            website = primary_source.url

        industry = _infer_industry(text)
        hq = _infer_headquarters(text)

        claims: list[AgentClaim] = []
        evidence = SourceEvidence(
            source_id=primary_source.source_id if primary_source else None,
            source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
            source_url=primary_source.url if primary_source else None,
            source_title=primary_source.title if primary_source else None,
            excerpt=primary_chunk.text[:280] if primary_chunk else None,
        )
        if website:
            claims.append(
                AgentClaim(
                    claim_text=f"Company website appears to be {website}.",
                    claim_type="identity_website",
                    confidence=0.7 if primary_source else 0.5,
                    evidence=evidence,
                )
            )
        if industry:
            claims.append(
                AgentClaim(
                    claim_text=f"Company appears to operate in {industry}.",
                    claim_type="identity_industry",
                    confidence=0.6 if text else 0.4,
                    evidence=evidence,
                )
            )
        if hq:
            claims.append(
                AgentClaim(
                    claim_text=f"Company appears associated with {hq}.",
                    claim_type="identity_headquarters",
                    confidence=0.55,
                    evidence=evidence,
                )
            )

        canonical_name = context.company_name
        if primary_source and primary_source.title:
            cleaned = re.sub(r"\s+\|\s+.*$", "", primary_source.title).strip()
            if cleaned:
                canonical_name = cleaned

        return IdentityAgentOutput(
            canonical_name=canonical_name,
            orgnr=context.orgnr,
            website=website,
            headquarters=hq,
            industry=industry,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={"source_count": len(context.sources), "chunk_count": len(context.chunks)},
        )

