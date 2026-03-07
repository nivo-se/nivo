"""Market analysis research agent."""

from __future__ import annotations

from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, MarketAnalysisAgentOutput, SourceEvidence


def _collect_matches(text: str, mapping: dict[str, list[str]], max_items: int = 4) -> list[str]:
    out: list[str] = []
    lower = text.lower()
    for label, keywords in mapping.items():
        if any(k in lower for k in keywords):
            out.append(label)
        if len(out) >= max_items:
            break
    return out


@dataclass(slots=True)
class MarketAnalysisAgent:
    """Builds structured market analysis using source evidence."""

    def run(self, context: AgentContext) -> MarketAnalysisAgentOutput:
        text = context.joined_text(max_chars=20000)

        trend_map = {
            "Digital transformation demand": ["digital", "automation", "cloud", "ai"],
            "Sustainability requirements": ["sustainability", "green", "esg", "carbon"],
            "Regulatory complexity": ["regulation", "compliance", "policy", "directive"],
            "Consolidation pressure": ["consolidation", "acquisition", "merger", "fragmented"],
        }
        risk_map = {
            "Macroeconomic demand slowdown": ["inflation", "recession", "slowdown"],
            "Competitive pricing pressure": ["competition", "price pressure", "margin pressure"],
            "Talent constraints": ["talent", "hiring", "skills shortage", "recruitment"],
            "Execution risk": ["execution", "integration", "operational risk"],
        }
        opportunity_map = {
            "Cross-sell expansion": ["cross-sell", "upsell", "expand product", "bundle"],
            "Geographic expansion": ["international", "export", "new market", "expansion"],
            "Operational efficiency gains": ["efficiency", "cost optimization", "productivity"],
            "Recurring revenue growth": ["subscription", "recurring", "annual contract"],
        }

        trends = _collect_matches(text, trend_map)
        risks = _collect_matches(text, risk_map)
        opportunities = _collect_matches(text, opportunity_map)

        market_size = "Not quantified from current sources"
        growth_rate = "Not quantified from current sources"
        if "growing market" in text.lower() or "high growth" in text.lower():
            growth_rate = "Market described as growing"

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
        if trends:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market trend: {trends[0]}",
                    claim_type="market_trend",
                    confidence=0.6,
                    evidence=evidence,
                )
            )
        if risks:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market risk: {risks[0]}",
                    claim_type="market_risk",
                    confidence=0.58,
                    evidence=evidence,
                )
            )
        if opportunities:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market opportunity: {opportunities[0]}",
                    claim_type="market_opportunity",
                    confidence=0.58,
                    evidence=evidence,
                )
            )

        return MarketAnalysisAgentOutput(
            market_size=market_size,
            growth_rate=growth_rate,
            trends=trends,
            risks=risks,
            opportunities=opportunities,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={"source_count": len(context.sources), "chunk_count": len(context.chunks)},
        )

