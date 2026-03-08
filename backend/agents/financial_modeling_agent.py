"""Financial modeling agent using deterministic assumptions and projections."""

from __future__ import annotations

from dataclasses import dataclass, field

from .assumptions_engine import AssumptionsEngine
from .context import AgentContext
from .projection_engine import ProjectionEngine
from .schemas import AgentClaim, FinancialModelingAgentOutput, SourceEvidence


@dataclass(slots=True)
class FinancialModelingAgent:
    """Generates deterministic financial models with scenario projections."""

    assumptions_engine: AssumptionsEngine = field(default_factory=AssumptionsEngine)
    projection_engine: ProjectionEngine = field(default_factory=ProjectionEngine)

    def run(
        self,
        context: AgentContext,
        strategy_payload: dict | None = None,
        value_creation_payload: dict | None = None,
    ) -> FinancialModelingAgentOutput:
        assumptions = self.assumptions_engine.build(
            context=context,
            strategy_payload=strategy_payload,
            value_creation_payload=value_creation_payload,
        )
        projections = self.projection_engine.build(assumptions)
        sensitivity = {
            "scenario_analysis": projections.get("scenario_summary", {}),
            "horizon_years": assumptions.get("horizon_years", 3),
        }

        source = context.primary_source()
        chunk = context.primary_chunk()
        claims = [
            AgentClaim(
                claim_text=(
                    f"Deterministic financial model generated for {context.company_name} "
                    f"with {assumptions.get('horizon_years', 3)}-year scenario projections."
                ),
                claim_type="financial_model",
                confidence=0.66,
                evidence=SourceEvidence(
                    source_id=source.source_id if source else None,
                    source_chunk_id=chunk.chunk_id if chunk else None,
                    source_url=source.url if source else None,
                    source_title=source.title if source else None,
                    excerpt=chunk.text[:280] if chunk else None,
                ),
            )
        ]

        return FinancialModelingAgentOutput(
            model_version="deterministic_v1",
            assumption_set=assumptions,
            forecast=projections,
            sensitivity=sensitivity,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={
                "engine": "assumptions+projection",
                "deterministic": True,
                "scenario_count": len(projections.get("scenarios", {})),
            },
        )

