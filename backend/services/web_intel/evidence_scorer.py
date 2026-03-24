"""Evidence scoring on relevance, authority, freshness, specificity."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .evidence_extractor import EvidenceItem

AUTHORITY_SCORES: dict[str, float] = {
    "company_site": 0.9,
    "public_authority": 0.85,
    "news": 0.75,
    "industry_report": 0.7,
    "database": 0.65,
    "marketplace": 0.5,
    "unknown": 0.5,
}

WEIGHTS = {"relevance": 0.3, "authority": 0.3, "freshness": 0.2, "specificity": 0.2}
DEFAULT_MINIMUM_SCORE = 0.5


class EvidenceScorer:
    """Score evidence on relevance, authority, freshness, specificity."""

    def __init__(
        self,
        *,
        weights: dict[str, float] | None = None,
        minimum_score: float = DEFAULT_MINIMUM_SCORE,
    ) -> None:
        self.weights = weights or WEIGHTS
        self.minimum_score = minimum_score

    def score(self, item: "EvidenceItem") -> "EvidenceItem":
        """Add overall_score and score_breakdown to EvidenceItem."""
        auth = AUTHORITY_SCORES.get(item.source_type, 0.5)
        rel = self._relevance(item)
        fresh = self._freshness(item)
        spec = self._specificity(item)

        w = self.weights
        overall = (
            w["relevance"] * rel
            + w["authority"] * auth
            + w["freshness"] * fresh
            + w["specificity"] * spec
        )
        breakdown = {
            "relevance": rel,
            "authority": auth,
            "freshness": fresh,
            "specificity": spec,
        }

        item.overall_score = round(overall, 4)
        item.score_breakdown = breakdown
        return item

    def _relevance(self, item: "EvidenceItem") -> float:
        """Query match in supporting_text (simple)."""
        if not item.query or not item.supporting_text:
            return 0.6
        q_words = set(item.query.lower().split()[:5])
        text_lower = item.supporting_text.lower()
        matches = sum(1 for w in q_words if len(w) > 2 and w in text_lower)
        return min(1.0, 0.5 + matches * 0.15)

    def _freshness(self, item: "EvidenceItem") -> float:
        """Placeholder: no published_at by default; assume recent."""
        return 0.7

    def _specificity(self, item: "EvidenceItem") -> float:
        """Numeric > range > qualitative."""
        if item.value and item.unit:
            return 0.9
        if item.value:
            return 0.75
        return 0.5

    def filter_by_threshold(self, items: list["EvidenceItem"]) -> tuple[list["EvidenceItem"], list["EvidenceItem"]]:
        """Split into accepted (>= threshold) and rejected (< threshold)."""
        accepted = []
        rejected = []
        for item in items:
            if (item.overall_score or 0) >= self.minimum_score:
                accepted.append(item)
            else:
                rejected.append(item)
        return accepted, rejected
