"""Strategy analysis agent."""

from __future__ import annotations

from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, SourceEvidence, StrategyAnalysisAgentOutput


@dataclass(slots=True)
class StrategyAnalysisAgent:
    """Generates strategic analysis from context and competitor outputs."""

    def run(self, context: AgentContext, competitor_payload: dict | None = None) -> StrategyAnalysisAgentOutput:
        text = context.joined_text(max_chars=18000).lower()
        competitor_count = len((competitor_payload or {}).get("competitors", []))

        thesis_parts = [f"{context.company_name} can grow through targeted execution in its core segments."]
        if "automation" in text or "digital" in text:
            thesis_parts.append("Technology-led demand should support growth.")
        if competitor_count:
            thesis_parts.append(
                f"Competitive intensity is meaningful ({competitor_count} identified peers), requiring differentiated positioning."
            )
        investment_thesis = " ".join(thesis_parts)

        acquisition_rationale = (
            f"Potential acquirer would gain access to {context.company_name}'s capabilities, customer relationships, and recurring delivery footprint."
        )

        key_risks: list[str] = []
        if "regulation" in text or "compliance" in text:
            key_risks.append("Regulatory and compliance burden")
        if "competition" in text or competitor_count >= 3:
            key_risks.append("Competitive pressure and pricing compression")
        if "talent" in text or "hiring" in text:
            key_risks.append("Talent retention and execution capacity")
        if not key_risks:
            key_risks.append("Go-to-market execution risk")

        diligence_focus = [
            "Validate customer retention and contract quality",
            "Assess product differentiation versus closest competitors",
            "Validate margin durability under pricing pressure",
        ]
        integration_themes = [
            "Commercial cross-sell across installed customer base",
            "Standardize delivery model and operating cadence",
            "Strengthen data/automation platform capabilities",
        ]

        source = context.primary_source()
        chunk = context.primary_chunk()
        claims = [
            AgentClaim(
                claim_text=f"Strategy thesis for {context.company_name} is supported by analyzed sources and market signals.",
                claim_type="strategy_thesis",
                confidence=0.62,
                evidence=SourceEvidence(
                    source_id=source.source_id if source else None,
                    source_chunk_id=chunk.chunk_id if chunk else None,
                    source_url=source.url if source else None,
                    source_title=source.title if source else None,
                    excerpt=chunk.text[:280] if chunk else None,
                ),
            )
        ]

        return StrategyAnalysisAgentOutput(
            investment_thesis=investment_thesis,
            acquisition_rationale=acquisition_rationale,
            key_risks=key_risks,
            diligence_focus=diligence_focus,
            integration_themes=integration_themes,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={"competitor_count": competitor_count},
        )

