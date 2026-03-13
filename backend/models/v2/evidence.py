"""Evidence and assumption schemas — canonical data contracts.

Per docs/deep_research/tightning/04-evidence-and-assumption-registry.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EvidenceSource(BaseModel):
    """Source provenance for an evidence item."""

    url: str = ""
    title: str | None = None
    domain: str | None = None
    source_type: str = "web"
    published_at: str | None = None
    retrieved_at: datetime | str | None = None


class EvidenceExtraction(BaseModel):
    """Extraction metadata."""

    supporting_text: str = ""
    page_ref: int | None = None
    extractor: str = "default"


class EvidenceScores(BaseModel):
    """Quality scores."""

    relevance_score: float = 0.0
    authority_score: float = 0.0
    freshness_score: float = 0.0
    specificity_score: float = 0.0
    overall_score: float = 0.0


class EvidenceValidation(BaseModel):
    """Validation state."""

    status: str = "pending"
    conflict_group_id: uuid.UUID | str | None = None
    notes: list[str] = Field(default_factory=list)


class EvidenceScope(BaseModel):
    """Scope for the evidence (geography, segment, period)."""

    geography: str | None = None
    segment: str | None = None
    period: str | None = None
    year: int | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class EvidenceItem(BaseModel):
    """Structured evidence item — one validated fact from a source."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    metric_key: str
    claim: str = ""
    value: float | None = None
    unit: str = ""
    definition: str = ""
    scope: EvidenceScope = Field(default_factory=EvidenceScope)
    source: EvidenceSource = Field(default_factory=EvidenceSource)
    extraction: EvidenceExtraction = Field(default_factory=EvidenceExtraction)
    scores: EvidenceScores = Field(default_factory=EvidenceScores)
    validation: EvidenceValidation = Field(default_factory=EvidenceValidation)
    extra: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSONB persistence."""
        d = self.model_dump(mode="json")
        d["id"] = str(self.id)
        if isinstance(self.validation.conflict_group_id, uuid.UUID):
            d["validation"]["conflict_group_id"] = str(self.validation.conflict_group_id)
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvidenceItem:
        """Deserialize from JSONB."""
        data = dict(data)
        if "id" in data and isinstance(data["id"], str):
            data["id"] = uuid.UUID(data["id"])
        if "validation" in data and isinstance(data["validation"], dict):
            cg = data["validation"].get("conflict_group_id")
            if isinstance(cg, str):
                data["validation"]["conflict_group_id"] = uuid.UUID(cg)
        return cls.model_validate(data)


class EvidenceCoverageSummary(BaseModel):
    """Coverage stats for a validated bundle."""

    required_metrics_total: int = 0
    required_metrics_covered: int = 0
    coverage_rate: float = 0.0
    extra: dict[str, Any] = Field(default_factory=dict)


class ValidatedEvidenceBundle(BaseModel):
    """Canonical evidence bundle — persisted per run."""

    company_id: uuid.UUID | str
    report_id: uuid.UUID | str
    generated_at: datetime | str
    items: list[EvidenceItem] = Field(default_factory=list)
    rejected_items: list[EvidenceItem] = Field(default_factory=list)
    conflict_log: list[dict[str, Any]] = Field(default_factory=list)
    coverage_summary: EvidenceCoverageSummary = Field(default_factory=EvidenceCoverageSummary)
    extra: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSONB persistence."""
        d = self.model_dump(mode="json")
        d["company_id"] = str(self.company_id) if self.company_id else None
        d["report_id"] = str(self.report_id) if self.report_id else None
        if isinstance(self.generated_at, datetime):
            d["generated_at"] = self.generated_at.isoformat()
        d["items"] = [i.to_dict() if isinstance(i, EvidenceItem) else i for i in self.items]
        d["rejected_items"] = [
            i.to_dict() if isinstance(i, EvidenceItem) else i for i in self.rejected_items
        ]
        return d
