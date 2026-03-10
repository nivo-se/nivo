"""Workstream 3: Compare target company vs verified competitors on key axes."""

from __future__ import annotations

from dataclasses import dataclass

from .competitor_market_schemas import (
    CompetitorProfileW3,
    EvidenceRef,
    PositioningAnalysis,
)
from .evidence_loader import EvidenceRecord


AXES = [
    "offering_breadth",
    "specialization",
    "customer_focus",
    "geography",
    "delivery_model",
    "differentiation",
    "scale_maturity",
]


def _infer_axis_signal(text: str, axis: str) -> str | None:
    """Infer a signal for an axis from text. Returns 'target_advantage', 'parity', 'competitor_advantage', or None (unclear)."""
    lower = text.lower()
    if axis == "offering_breadth":
        if any(k in lower for k in ["broader", "wider", "full suite", "end-to-end"]):
            return "target_advantage"
        if any(k in lower for k in ["narrower", "focused", "specialized"]):
            return "competitor_advantage"
    if axis == "specialization":
        if any(k in lower for k in ["specialist", "niche", "vertical"]):
            return "competitor_advantage"
        if any(k in lower for k in ["generalist", "broad"]):
            return "target_advantage"
    if axis == "customer_focus":
        if any(k in lower for k in ["enterprise", "large"]):
            return "parity"
    if axis == "geography":
        if any(k in lower for k in ["global", "international", "nordic"]):
            return "parity"
    if axis == "delivery_model":
        if any(k in lower for k in ["saas", "cloud", "subscription"]):
            return "parity"
    if axis == "scale_maturity":
        if any(k in lower for k in ["leader", "market leader", "largest"]):
            return "competitor_advantage"
        if any(k in lower for k in ["emerging", "growing", "challenger"]):
            return "target_advantage"
    return None


@dataclass(slots=True)
class PositioningEngine:
    """Compare target vs competitors; output differentiated, parity, disadvantage, unclear axes."""

    def analyze(
        self,
        *,
        company_profile: dict,
        competitor_profiles: list[CompetitorProfileW3],
        evidence: list[EvidenceRecord],
    ) -> PositioningAnalysis:
        """Produce positioning analysis: differentiated_axes, parity_axes, disadvantage_axes, unclear_axes."""
        differentiated: list[str] = []
        parity: list[str] = []
        disadvantage: list[str] = []
        unclear: list[str] = []

        # Combine evidence text for competitor mentions
        combined = " ".join(e.claim for e in evidence if e.claim)
        combined += " " + " ".join(e.supporting_text or "" for e in evidence)

        # Combine competitor profile text
        for p in competitor_profiles:
            combined += " " + (p.description or "")
            combined += " " + " ".join(p.product_focus or [])

        evidence_refs: list[EvidenceRef] = []
        for e in evidence[:5]:  # Limit refs
            evidence_refs.append(
                EvidenceRef(
                    web_evidence_id=e.id,
                    source_url=e.source_url,
                    source_id=e.source_id,
                    excerpt=e.supporting_text[:280] if e.supporting_text else None,
                )
            )

        for axis in AXES:
            signal = _infer_axis_signal(combined, axis)
            if signal == "target_advantage":
                differentiated.append(axis)
            elif signal == "parity":
                parity.append(axis)
            elif signal == "competitor_advantage":
                disadvantage.append(axis)
            else:
                unclear.append(axis)

        # Build summary
        parts = []
        if differentiated:
            parts.append(f"Differentiated on: {', '.join(differentiated)}")
        if parity:
            parts.append(f"Parity on: {', '.join(parity)}")
        if disadvantage:
            parts.append(f"Disadvantage on: {', '.join(disadvantage)}")
        if unclear:
            parts.append(f"Unclear: {', '.join(unclear)}")
        summary = "; ".join(parts) if parts else "Positioning insufficiently evidenced from current sources."

        return PositioningAnalysis(
            differentiated_axes=differentiated,
            parity_axes=parity,
            disadvantage_axes=disadvantage,
            unclear_axes=unclear,
            positioning_summary=summary,
            evidence_refs=evidence_refs,
            metadata={},
        )
