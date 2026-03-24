"""Workstream 3: Verify competitor candidates based on overlap evidence."""

from __future__ import annotations

from dataclasses import dataclass

from .competitor_market_schemas import (
    CompetitorCandidateW3,
    VerificationStatus,
    VerifiedCompetitor,
)
from .evidence_loader import EvidenceRecord


def _score_overlap(
    candidate: CompetitorCandidateW3,
    company_profile: dict,
    evidence: list[EvidenceRecord],
) -> dict[str, float]:
    """Score overlap on offering, customer, geography, business model. Returns 0-1 per axis."""
    scores: dict[str, float] = {
        "offering": 0.0,
        "customer_segment": 0.0,
        "geography": 0.0,
        "business_model": 0.0,
    }
    target_products = [str(p).lower() for p in (company_profile.get("products_services") or [])]
    target_customers = [str(c).lower() for c in (company_profile.get("customer_segments") or company_profile.get("customer_segments_profile") or [])]
    target_geos = [str(g).lower() for g in (company_profile.get("geographies") or [])]

    # Gather evidence text for this candidate (EvidenceRef uses web_evidence_id = EvidenceRecord.id)
    ev_ids = {r.web_evidence_id for r in candidate.evidence_refs if r.web_evidence_id}
    ev_by_id = {e.id: e for e in evidence if e.id}
    texts: list[str] = []
    for eid in ev_ids:
        if eid in ev_by_id:
            ev = ev_by_id[eid]
            texts.append(f"{ev.claim} {ev.supporting_text or ''}")
    combined = " ".join(texts).lower()

    if not combined:
        return scores

    # Offering overlap: product/service keywords
    for p in target_products:
        if p and len(p) > 2 and p in combined:
            scores["offering"] = max(scores["offering"], 0.7)
    if scores["offering"] == 0 and any(kw in combined for kw in ["product", "service", "solution", "platform", "software"]):
        scores["offering"] = 0.4

    # Customer segment
    for c in target_customers:
        if c and len(c) > 2 and c in combined:
            scores["customer_segment"] = max(scores["customer_segment"], 0.7)
    if scores["customer_segment"] == 0 and any(kw in combined for kw in ["b2b", "enterprise", "sme", "consumer"]):
        scores["customer_segment"] = 0.3

    # Geography
    for g in target_geos:
        if g and len(g) > 2 and g in combined:
            scores["geography"] = max(scores["geography"], 0.7)
    if scores["geography"] == 0 and any(kw in combined for kw in ["nordic", "europe", "global", "us", "uk"]):
        scores["geography"] = 0.3

    # Business model (harder to infer)
    if any(kw in combined for kw in ["subscription", "saas", "license", "recurring"]):
        scores["business_model"] = 0.5

    return scores


def _is_cooccurrence_only(candidate: CompetitorCandidateW3, evidence: list[EvidenceRecord]) -> bool:
    """True if candidate is only mentioned alongside target with no overlap evidence."""
    ev_ids = {r.web_evidence_id for r in candidate.evidence_refs if r.web_evidence_id}
    ev_by_id = {e.id: e for e in evidence}
    for eid in ev_ids:
        if eid in ev_by_id:
            ev = ev_by_id[eid]
            text = (ev.claim or "") + " " + (ev.supporting_text or "")
            # Co-occurrence only: "X and Y" or "X, Y" with no descriptive overlap
            if " and " in text or ", " in text:
                # Check if there's any descriptive content beyond the list
                words = text.split()
                if len(words) < 15:  # Very short = likely just a list
                    return True
    return False


@dataclass(slots=True)
class CompetitorVerifier:
    """Verify candidates; reject weak or co-occurrence-only matches."""

    min_offering_overlap: float = 0.3
    min_total_overlap: float = 0.25
    reject_cooccurrence_only: bool = True

    def verify(
        self,
        candidates: list[CompetitorCandidateW3],
        company_profile: dict,
        evidence: list[EvidenceRecord],
    ) -> list[VerifiedCompetitor]:
        """Verify each candidate; classify as verified_direct, verified_adjacent, substitute, weak_candidate, or rejected."""
        results: list[VerifiedCompetitor] = []
        for c in candidates:
            overlap = _score_overlap(c, company_profile, evidence)
            total = sum(overlap.values()) / 4.0 if overlap else 0.0

            if self.reject_cooccurrence_only and _is_cooccurrence_only(c, evidence):
                results.append(
                    VerifiedCompetitor(
                        name=c.name,
                        website=c.website,
                        verification_status="rejected",
                        rejection_reason="cooccurrence_only",
                        overlap_scores=overlap,
                        evidence_refs=c.evidence_refs,
                        metadata=c.metadata,
                    )
                )
                continue

            if total < self.min_total_overlap and overlap.get("offering", 0) < self.min_offering_overlap:
                results.append(
                    VerifiedCompetitor(
                        name=c.name,
                        website=c.website,
                        verification_status="rejected",
                        rejection_reason="insufficient_overlap",
                        overlap_scores=overlap,
                        evidence_refs=c.evidence_refs,
                        metadata=c.metadata,
                    )
                )
                continue

            if total >= 0.5 and overlap.get("offering", 0) >= 0.5 and c.candidate_type == "direct":
                status: VerificationStatus = "verified_direct"
            elif c.candidate_type == "substitute":
                status = "substitute"
            elif total >= self.min_total_overlap:
                status = "verified_adjacent"
            else:
                status = "weak_candidate"

            results.append(
                VerifiedCompetitor(
                    name=c.name,
                    website=c.website,
                    verification_status=status,
                    rejection_reason=None,
                    overlap_scores=overlap,
                    evidence_refs=c.evidence_refs,
                    metadata=c.metadata,
                )
            )
        return results
