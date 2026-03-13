"""Report spec schema — machine-readable contract for a research run.

Per docs/deep_research/tightning/02-report-spec-schema.md.
"""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class ReportSpecCompany(BaseModel):
    """Target company in report spec."""

    company_id: str | None = None
    legal_name: str = ""
    org_number: str | None = None
    website: str | None = None
    country: str = "SE"
    currency: str = "SEK"


class AnalystContext(BaseModel):
    """Optional analyst input."""

    note: str | None = None


class ResearchScope(BaseModel):
    """Analytical frame for the run."""

    primary_question: str | None = None
    geography_scope: list[str] = Field(default_factory=list)
    industry_scope: list[str] = Field(default_factory=list)
    time_horizon_years: int = 5
    extra: dict[str, Any] = Field(default_factory=dict)


class RequiredMetric(BaseModel):
    """Parameter request for retrieval/valuation."""

    key: str
    definition: str = ""
    unit: str = ""
    geography: str | None = None
    segment: str | None = None
    period: str | None = None
    year: int | None = None
    min_sources: int = 2
    max_source_age_days: int = 365
    extra: dict[str, Any] = Field(default_factory=dict)


class PolicyVersions(BaseModel):
    """Locked policy versions for reproducibility."""

    valuation_policy_version: str = "dcf_v1"
    comp_policy_version: str = "multiples_v1"
    evidence_policy_version: str = "evidence_v1"
    uncertainty_policy_version: str = "uncertainty_v1"


class AcceptanceRules(BaseModel):
    """Stage gating and report strictness."""

    require_market_niche: bool = True
    minimum_average_evidence_score: float = 0.70
    require_verified_market_evidence: bool = True
    require_source_diversity: bool = True
    extra: dict[str, Any] = Field(default_factory=dict)


class OutputPreferences(BaseModel):
    """Formatting and optional sections."""

    include_valuation: bool = True
    include_citations: bool = True
    include_scenarios: bool = True
    preferred_language: str = "en"
    extra: dict[str, Any] = Field(default_factory=dict)


class ReportSpec(BaseModel):
    """Canonical report spec — machine-readable contract for a research run."""

    report_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    company: ReportSpecCompany = Field(default_factory=ReportSpecCompany)
    run_mode: str = "standard_deep_research"
    analyst_context: AnalystContext = Field(default_factory=AnalystContext)
    research_scope: ResearchScope = Field(default_factory=ResearchScope)
    required_outputs: list[str] = Field(
        default_factory=lambda: [
            "company_profile",
            "market_model",
            "competitor_set",
            "assumption_registry",
            "valuation_output",
        ]
    )
    required_metrics: list[RequiredMetric] = Field(default_factory=list)
    policy_versions: PolicyVersions = Field(default_factory=PolicyVersions)
    acceptance_rules: AcceptanceRules = Field(default_factory=AcceptanceRules)
    output_preferences: OutputPreferences = Field(default_factory=OutputPreferences)
    extra: dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSONB persistence."""
        d = self.model_dump(mode="json")
        d["report_id"] = str(self.report_id)
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReportSpec:
        """Deserialize from JSONB."""
        if "report_id" in data and isinstance(data["report_id"], str):
            data = dict(data)
            data["report_id"] = uuid.UUID(data["report_id"])
        return cls.model_validate(data)
