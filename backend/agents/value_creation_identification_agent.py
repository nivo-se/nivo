"""Value creation identification agent."""

from __future__ import annotations

from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, SourceEvidence, ValueCreationIdentificationAgentOutput


@dataclass(slots=True)
class ValueCreationIdentificationAgent:
    """Identifies concrete value-creation initiatives and KPI frameworks."""

    def run(self, context: AgentContext, strategy_payload: dict | None = None) -> ValueCreationIdentificationAgentOutput:
        strategy_risks = list((strategy_payload or {}).get("key_risks", []))
        strategy_focus = list((strategy_payload or {}).get("diligence_focus", []))

        initiatives = [
            "Increase cross-sell penetration in existing enterprise accounts",
            "Automate service delivery to improve gross margin",
            "Expand into adjacent Nordic/European verticals",
        ]
        if any("pricing" in str(r).lower() for r in strategy_risks):
            initiatives.append("Re-segment pricing and packaging to protect unit economics")

        timeline = [
            "0-100 days: commercial baseline and quick-win execution",
            "3-9 months: platform/process standardization",
            "9-24 months: scale expansion and add-on optimization",
        ]

        kpis = [
            "Net revenue retention (%)",
            "Gross margin (%)",
            "Sales pipeline conversion (%)",
            "Implementation cycle time (days)",
        ]
        if strategy_focus:
            kpis.append("Customer concentration and churn metrics")

        source = context.primary_source()
        chunk = context.primary_chunk()
        claims = [
            AgentClaim(
                claim_text=f"Value creation plan identified operational and commercial levers for {context.company_name}.",
                claim_type="value_creation_plan",
                confidence=0.6,
                evidence=SourceEvidence(
                    source_id=source.source_id if source else None,
                    source_chunk_id=chunk.chunk_id if chunk else None,
                    source_url=source.url if source else None,
                    source_title=source.title if source else None,
                    excerpt=chunk.text[:280] if chunk else None,
                ),
            )
        ]

        return ValueCreationIdentificationAgentOutput(
            initiatives=initiatives,
            timeline=timeline,
            kpis=kpis,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={
                "strategy_risk_count": len(strategy_risks),
                "strategy_focus_count": len(strategy_focus),
            },
        )

