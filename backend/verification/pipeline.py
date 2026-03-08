"""Verification pipeline for Deep Research claims and outputs."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

CLAIM_TYPE_CONFIG: dict[str, dict[str, Any]] = {
    "financial_model": {"min_confidence": 0.75, "require_evidence": True},
    "valuation": {"min_confidence": 0.75, "require_evidence": True},
    "market_analysis": {"min_confidence": 0.65, "require_evidence": True},
    "competitor_intelligence": {"min_confidence": 0.60, "require_evidence": True},
    "strategy_analysis": {"min_confidence": 0.55, "require_evidence": False},
    "identity": {"min_confidence": 0.55, "require_evidence": False},
    "company_profile": {"min_confidence": 0.55, "require_evidence": False},
    "value_creation": {"min_confidence": 0.55, "require_evidence": False},
}

VERIFICATION_STATUSES = ("SUPPORTED", "UNSUPPORTED", "UNCERTAIN", "CONFLICTING")

_DEFAULT_CONFIG = {"min_confidence": 0.55, "require_evidence": False}
_UNCERTAIN_FLOOR = 0.40


@dataclass(slots=True)
class VerificationPipeline:
    """Performs deterministic evidence and confidence checks on claims with per-type thresholds."""

    name: str = "default_verification"
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

    @staticmethod
    def _has_evidence(claim: Any) -> bool:
        evidence = claim.evidence if isinstance(getattr(claim, "evidence", None), dict) else {}
        return bool(getattr(claim, "source_chunk_id", None)) or bool(
            evidence.get("source_chunk_id") or evidence.get("source_id")
        )

    def _resolve_threshold(self, claim_type: str | None, strict_mode: bool) -> float:
        if strict_mode:
            return self.strict_min_confidence
        cfg = CLAIM_TYPE_CONFIG.get(claim_type or "", _DEFAULT_CONFIG)
        return cfg["min_confidence"]

    def _classify_claim(
        self, claim: Any, strict_mode: bool
    ) -> str:
        claim_type = getattr(claim, "claim_type", None)
        threshold = self._resolve_threshold(claim_type, strict_mode)
        cfg = CLAIM_TYPE_CONFIG.get(claim_type or "", _DEFAULT_CONFIG)
        has_ev = self._has_evidence(claim)
        confidence = self._as_float(getattr(claim, "confidence", 0.0))

        evidence_required = cfg["require_evidence"] or strict_mode

        if has_ev and confidence >= threshold:
            return "SUPPORTED"
        if evidence_required and not has_ev:
            return "UNSUPPORTED"
        if not has_ev and confidence < _UNCERTAIN_FLOOR:
            return "UNSUPPORTED"
        if has_ev and _UNCERTAIN_FLOOR <= confidence < threshold:
            return "UNCERTAIN"
        if confidence < _UNCERTAIN_FLOOR:
            return "UNSUPPORTED"
        if not evidence_required and confidence >= threshold:
            return "SUPPORTED"
        return "UNCERTAIN"

    def run(self, claims: list[Any], *, strict_mode: bool = False) -> dict:
        issues: list[str] = []
        claim_updates: list[dict[str, Any]] = []

        total = len(claims)
        with_evidence = 0
        supported = 0
        unsupported = 0
        uncertain = 0
        per_type_stats: dict[str, dict[str, int]] = {}

        for claim in claims:
            has_ev = self._has_evidence(claim)
            if has_ev:
                with_evidence += 1
            status = self._classify_claim(claim, strict_mode)

            claim_type = getattr(claim, "claim_type", "unknown") or "unknown"
            if claim_type not in per_type_stats:
                per_type_stats[claim_type] = {"total": 0, "supported": 0, "unsupported": 0, "uncertain": 0}
            per_type_stats[claim_type]["total"] += 1
            per_type_stats[claim_type][status.lower()] = per_type_stats[claim_type].get(status.lower(), 0) + 1

            if status == "SUPPORTED":
                supported += 1
            elif status == "UNSUPPORTED":
                unsupported += 1
            else:
                uncertain += 1

            claim_updates.append({
                "claim_id": str(claim.id),
                "is_verified": status == "SUPPORTED",
                "verification_status": status,
            })

        if total == 0:
            issues.append("no_claims_available_for_verification")
        if with_evidence < total:
            issues.append("some_claims_missing_evidence")
        if unsupported > 0:
            issues.append("some_claims_unsupported")

        verification_passed = total > 0 and unsupported == 0
        pipeline_status = "completed" if (total > 0 and (verification_passed or not strict_mode)) else "failed"
        if total == 0:
            pipeline_status = "failed"

        return {
            "pipeline": self.name,
            "strict_mode": strict_mode,
            "status": pipeline_status,
            "verified": verification_passed,
            "issues": issues,
            "stats": {
                "total_claims": total,
                "claims_with_evidence": with_evidence,
                "claims_supported": supported,
                "claims_unsupported": unsupported,
                "claims_uncertain": uncertain,
                "per_type": per_type_stats,
            },
            "claim_updates": claim_updates,
        }

    def health(self) -> dict:
        return {"pipeline": self.name, "ready": True}
