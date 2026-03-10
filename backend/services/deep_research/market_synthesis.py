"""Workstream 3: Produce evidence-backed market synthesis for downstream strategy/valuation."""

from __future__ import annotations

from dataclasses import dataclass

from .competitor_market_schemas import (
    CompetitorProfileW3,
    EvidenceRef,
    MarketModel,
    MarketSynthesis,
    PositioningAnalysis,
)
from .evidence_loader import EvidenceRecord


@dataclass(slots=True)
class MarketSynthesisService:
    """Produce market attractiveness, competition intensity, niche defensibility, growth support, uncertainties."""

    def synthesize(
        self,
        *,
        market_model: MarketModel,
        positioning_analysis: PositioningAnalysis,
        competitor_profiles: list[CompetitorProfileW3],
        evidence: list[EvidenceRecord],
    ) -> MarketSynthesis:
        """Build evidence-backed synthesis with scores and key claims."""
        # Aggregate evidence refs
        evidence_refs: list[EvidenceRef] = list(market_model.evidence_refs or [])
        seen_ids = {r.web_evidence_id for r in evidence_refs if r.web_evidence_id}
        for r in (positioning_analysis.evidence_refs or []):
            if r.web_evidence_id and r.web_evidence_id not in seen_ids:
                evidence_refs.append(r)
                seen_ids.add(r.web_evidence_id)

        # Market attractiveness: higher when growth, low fragmentation, demand drivers
        attr = 0.5
        if market_model.market_growth_signal:
            attr += 0.15
        if market_model.demand_drivers:
            attr += 0.1 * min(len(market_model.demand_drivers), 3)
        if market_model.fragmentation_signal and "fragmented" in (market_model.fragmentation_signal or "").lower():
            attr += 0.05  # Fragmented = opportunity for consolidation
        market_attractiveness_score = min(0.95, round(attr, 2))

        # Competition intensity: higher when more verified competitors
        n_comp = len([p for p in competitor_profiles if p.verification_status in ("verified_direct", "verified_adjacent")])
        competition_intensity_score = min(0.95, round(0.3 + n_comp * 0.1, 2))

        # Niche defensibility: higher when differentiated axes, lower when many disadvantage
        diff_count = len(positioning_analysis.differentiated_axes or [])
        disadv_count = len(positioning_analysis.disadvantage_axes or [])
        unclear_count = len(positioning_analysis.unclear_axes or [])
        defensibility = 0.5 + diff_count * 0.08 - disadv_count * 0.08 - unclear_count * 0.02
        niche_defensibility_score = max(0.1, min(0.95, round(defensibility, 2)))

        # Growth support: from market model growth signal
        growth_support = 0.5
        if market_model.market_growth_signal:
            growth_support = 0.7
        growth_support_score = round(growth_support, 2)

        # Key supporting claims
        key_claims: list[str] = []
        if market_model.market_label and market_model.market_label != "Unspecified market":
            key_claims.append(f"Market: {market_model.market_label}")
        if market_model.market_growth_signal:
            key_claims.append(f"Growth: {market_model.market_growth_signal}")
        if market_model.demand_drivers:
            key_claims.append(f"Demand drivers: {', '.join(market_model.demand_drivers[:3])}")
        if positioning_analysis.differentiated_axes:
            key_claims.append(f"Differentiated on: {', '.join(positioning_analysis.differentiated_axes)}")

        # Key uncertainties
        uncertainties: list[str] = []
        if positioning_analysis.unclear_axes:
            uncertainties.append(f"Unclear positioning on: {', '.join(positioning_analysis.unclear_axes)}")
        if not market_model.market_growth_signal:
            uncertainties.append("Market growth not quantified")
        if n_comp < 2:
            uncertainties.append("Limited competitor set for comparison")
        if not key_claims:
            uncertainties.append("Synthesis based on limited evidence")

        # Summary
        summary_parts = [
            f"Market attractiveness: {market_attractiveness_score:.2f}",
            f"Competition intensity: {competition_intensity_score:.2f}",
            f"Niche defensibility: {niche_defensibility_score:.2f}",
            f"Growth support: {growth_support_score:.2f}",
        ]
        if key_claims:
            summary_parts.append("Key claims: " + "; ".join(key_claims[:3]))
        if uncertainties:
            summary_parts.append("Uncertainties: " + "; ".join(uncertainties[:2]))
        synthesis_summary = ". ".join(summary_parts)

        # Confidence
        n_ev = len(evidence_refs)
        confidence = min(0.9, 0.3 + n_ev * 0.05 + market_model.confidence_score * 0.2)

        return MarketSynthesis(
            market_attractiveness_score=market_attractiveness_score,
            competition_intensity_score=competition_intensity_score,
            niche_defensibility_score=niche_defensibility_score,
            growth_support_score=growth_support_score,
            synthesis_summary=synthesis_summary,
            key_supporting_claims=key_claims,
            key_uncertainties=uncertainties,
            evidence_refs=evidence_refs,
            confidence_score=round(confidence, 2),
            metadata={},
        )
