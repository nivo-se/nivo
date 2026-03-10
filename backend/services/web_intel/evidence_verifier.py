"""Evidence verification: cluster, corroborate, detect contradictions."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .evidence_extractor import EvidenceItem

VerificationStatus = str  # "verified" | "weakly_supported" | "conflicting" | "rejected"


def _normalize_claim_key(claim_type: str, claim: str) -> str:
    """Normalize claim for clustering (e.g. market_size + workwear europe)."""
    key = claim_type.lower()
    words = re.findall(r"\b[a-zåäö]{4,}\b", claim.lower())
    if words:
        key += " " + " ".join(words[:5])
    return key[:80]


def _values_conflict(v1: str | None, v2: str | None) -> bool:
    """Check if two values conflict (e.g. different market sizes)."""
    if not v1 or not v2:
        return False
    try:
        n1 = float(v1.replace(",", "."))
        n2 = float(v2.replace(",", "."))
        if abs(n1 - n2) / max(abs(n1), abs(n2), 1) > 0.5:
            return True
    except (ValueError, TypeError):
        pass
    return v1.strip() != v2.strip()


class EvidenceVerifier:
    """Cluster claims; mark verified, weakly_supported, conflicting, rejected."""

    def __init__(
        self,
        *,
        min_corroboration: int = 2,
        max_unresolved_conflicts: int = 2,
        score_threshold: float = 0.5,
    ) -> None:
        self.min_corroboration = min_corroboration
        self.max_unresolved_conflicts = max_unresolved_conflicts
        self.score_threshold = score_threshold

    def verify(self, items: list["EvidenceItem"]) -> list["EvidenceItem"]:
        """Set verification_status on each item."""
        clusters: dict[str, list["EvidenceItem"]] = defaultdict(list)
        for item in items:
            key = _normalize_claim_key(item.claim_type, item.claim)
            clusters[key].append(item)

        for cluster_items in clusters.values():
            self._verify_cluster(cluster_items)

        return items

    def _verify_cluster(self, cluster: list["EvidenceItem"]) -> None:
        """Verify a cluster of similar claims."""
        above_threshold = [i for i in cluster if (i.overall_score or 0) >= self.score_threshold]
        below = [i for i in cluster if (i.overall_score or 0) < self.score_threshold]


        for item in below:
            item.verification_status = "rejected"

        if not above_threshold:
            return

        values = [i.value for i in above_threshold if i.value]
        conflicts = 0
        for i, a in enumerate(above_threshold):
            for b in above_threshold[i + 1 :]:
                if _values_conflict(a.value, b.value):
                    conflicts += 1

        if conflicts > self.max_unresolved_conflicts:
            for item in above_threshold:
                item.verification_status = "conflicting"
            return

        if len(above_threshold) >= self.min_corroboration and conflicts == 0:
            for item in above_threshold:
                item.verification_status = "verified"
        else:
            for item in above_threshold:
                item.verification_status = "weakly_supported"
