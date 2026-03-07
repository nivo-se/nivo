"""Valuation analysis agent using deterministic valuation engine."""

from __future__ import annotations

from dataclasses import dataclass, field

from .context import AgentContext
from .schemas import AgentClaim, SourceEvidence, ValuationAnalysisAgentOutput
from .valuation_engine import ValuationEngine


@dataclass(slots=True)
class ValuationAnalysisAgent:
    """Produces valuation ranges from deterministic financial model outputs."""

    valuation_engine: ValuationEngine = field(default_factory=ValuationEngine)

    def run(
        self,
        context: AgentContext,
        financial_model_payload: dict,
    ) -> ValuationAnalysisAgentOutput:
        assumptions = financial_model_payload.get("assumption_set", {})
        forecast = financial_model_payload.get("forecast", {})
        valuation = self.valuation_engine.build(assumptions, forecast)

        source = context.primary_source()
        chunk = context.primary_chunk()
        claims = [
            AgentClaim(
                claim_text=(
                    f"Valuation range for {context.company_name} is derived from deterministic "
                    "scenario-based discounted cash flow analysis."
                ),
                claim_type="valuation",
                confidence=0.64,
                evidence=SourceEvidence(
                    source_id=source.source_id if source else None,
                    source_chunk_id=chunk.chunk_id if chunk else None,
                    source_url=source.url if source else None,
                    source_title=source.title if source else None,
                    excerpt=chunk.text[:280] if chunk else None,
                ),
            )
        ]

        return ValuationAnalysisAgentOutput(
            method=valuation.get("method", "deterministic_dcf"),
            enterprise_value=valuation.get("enterprise_value_msek"),
            equity_value=valuation.get("equity_value_msek"),
            valuation_range_low=valuation.get("valuation_range_low_msek"),
            valuation_range_high=valuation.get("valuation_range_high_msek"),
            currency=valuation.get("currency", "SEK"),
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={
                "deterministic": True,
                "net_debt_msek": valuation.get("net_debt_msek"),
                "scenario_valuations": valuation.get("scenario_valuations", {}),
            },
        )

