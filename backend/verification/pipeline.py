"""Verification pipeline for Deep Research claims and outputs."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


@dataclass(slots=True)
class VerificationPipeline:
    """Performs deterministic evidence and confidence checks on claims."""

    name: str = "default_verification"
    min_confidence: float = 0.55
    strict_min_confidence: float = 0.7

    @staticmethod
    def _as_float(value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def run(self, claims: list[Any], *, strict_mode: bool = False) -> dict:
        threshold = self.strict_min_confidence if strict_mode else self.min_confidence
        issues: list[str] = []
        claim_updates: list[dict[str, Any]] = []

        total = len(claims)
        with_evidence = 0
        low_confidence = 0
        verified_count = 0

        for claim in claims:
            evidence = claim.evidence if isinstance(getattr(claim, "evidence", None), dict) else {}
            has_evidence = bool(getattr(claim, "source_chunk_id", None)) or bool(
                evidence.get("source_chunk_id") or evidence.get("source_id")
            )
            if has_evidence:
                with_evidence += 1
            confidence = self._as_float(getattr(claim, "confidence", 0.0))
            verified = has_evidence and confidence >= threshold
            if confidence < threshold:
                low_confidence += 1
            if verified:
                verified_count += 1
            claim_updates.append({"claim_id": str(claim.id), "is_verified": verified})

        if total == 0:
            issues.append("no_claims_available_for_verification")
        if with_evidence < total:
            issues.append("some_claims_missing_evidence")
        if low_confidence > 0:
            issues.append("some_claims_below_confidence_threshold")

        verification_passed = total > 0 and with_evidence == total and low_confidence == 0
        status = "completed" if verification_passed else "failed"
        if not strict_mode and total > 0 and with_evidence > 0:
            # In normal mode we keep the pipeline moving while surfacing quality issues.
            status = "completed"

        return {
            "pipeline": self.name,
            "strict_mode": strict_mode,
            "threshold": threshold,
            "status": status,
            "verified": verification_passed,
            "issues": issues,
            "stats": {
                "total_claims": total,
                "claims_with_evidence": with_evidence,
                "claims_verified": verified_count,
                "claims_below_threshold": low_confidence,
            },
            "claim_updates": claim_updates,
        }

    def health(self) -> dict:
        return {"pipeline": self.name, "ready": True}

