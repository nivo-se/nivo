"""Assumption registry schemas — valuation-grade parameter objects.

Per docs/deep_research/tightning/04-evidence-and-assumption-registry.md.
"""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class AssumptionScope(BaseModel):
    """Scope for an assumption."""

    geography: str | None = None
    segment: str | None = None
    period: str | None = None
    year: int | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class PointEstimates(BaseModel):
    """Low/base/high interval."""

    low: float | None = None
    base: float
    high: float | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class PolicyRefs(BaseModel):
    """Policy versions used for derivation."""

    evidence_policy_version: str = "evidence_v1"
    uncertainty_policy_version: str = "uncertainty_v1"
    extra: dict[str, Any] = Field(default_factory=dict)


class AssumptionItem(BaseModel):
    """Valuation-grade assumption derived from evidence."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    key: str
    category: str = "market_growth"
    definition: str = ""
    unit: str = ""
    scope: AssumptionScope = Field(default_factory=AssumptionScope)
    point_estimates: PointEstimates | None = None
    confidence_score: float = 0.0
    derivation_method: str = "conflict_resolved_interval"
    evidence_refs: list[uuid.UUID | str] = Field(default_factory=list)
    policy_refs: PolicyRefs = Field(default_factory=PolicyRefs)
    status: str = "accepted"
    notes: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSONB persistence."""
        d = self.model_dump(mode="json")
        d["id"] = str(self.id)
        d["evidence_refs"] = [str(r) if isinstance(r, uuid.UUID) else r for r in self.evidence_refs]
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AssumptionItem:
        """Deserialize from JSONB."""
        data = dict(data)
        if "id" in data and isinstance(data["id"], str):
            data["id"] = uuid.UUID(data["id"])
        if "evidence_refs" in data:
            data["evidence_refs"] = [
                uuid.UUID(r) if isinstance(r, str) else r for r in data["evidence_refs"]
            ]
        return cls.model_validate(data)


class AssumptionRegistryCompleteness(BaseModel):
    """Completeness summary for assumption registry."""

    required_total: int = 0
    accepted_total: int = 0
    missing_keys: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)


class AssumptionRegistryReadiness(BaseModel):
    """Valuation readiness status."""

    valuation_ready: bool = False
    blocked_reasons: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)


class AssumptionRegistry(BaseModel):
    """Canonical assumption registry — persisted per run."""

    report_id: uuid.UUID | str
    version: str = "ar_v1"
    assumptions: list[AssumptionItem] = Field(default_factory=list)
    completeness: AssumptionRegistryCompleteness = Field(default_factory=AssumptionRegistryCompleteness)
    readiness: AssumptionRegistryReadiness = Field(default_factory=AssumptionRegistryReadiness)
    extra: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSONB persistence."""
        d = self.model_dump(mode="json")
        d["report_id"] = str(self.report_id) if self.report_id else None
        d["assumptions"] = [a.to_dict() if isinstance(a, AssumptionItem) else a for a in self.assumptions]
        return d
