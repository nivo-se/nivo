"""Deep Research API request/response contracts and wrapper models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Generic, Literal, Optional, TypeVar

from pydantic import BaseModel, Field, model_validator

T = TypeVar("T")


class ApiError(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ApiMeta(BaseModel):
    request_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "v1"


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ApiError] = None
    meta: ApiMeta = Field(default_factory=ApiMeta)


class UserSourceInput(BaseModel):
    """User-provided source for inline ingestion at analysis start."""

    source_type: Literal["url", "document", "note"]
    url: str | None = Field(default=None, max_length=2048)
    raw_text: str | None = Field(default=None, max_length=50000)
    title: str | None = Field(default=None, max_length=256)

    @model_validator(mode="after")
    def validate_source_payload(self) -> "UserSourceInput":
        if self.source_type == "url" and not self.url:
            raise ValueError("url is required when source_type=url")
        if not self.url and not self.raw_text:
            raise ValueError("At least one of url or raw_text must be provided")
        return self


class AnalysisStartRequest(BaseModel):
    run_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    orgnr: str | None = Field(default=None, min_length=4, max_length=32)
    company_name: str | None = Field(default=None, min_length=1, max_length=512)
    website: str | None = Field(default=None, max_length=2048)
    analysis_type: Literal["full", "refresh", "quick"] = "full"
    priority: Literal["low", "normal", "high"] = "normal"
    query: str | None = Field(default=None, max_length=4000)
    sources: list[UserSourceInput] | None = Field(default=None)

    @model_validator(mode="after")
    def validate_target(self) -> "AnalysisStartRequest":
        if not self.company_id and not self.orgnr and not self.company_name:
            raise ValueError("Either company_id, orgnr, or company_name must be provided")
        if self.sources and len(self.sources) > 20:
            raise ValueError("At most 20 sources per request")
        return self


class AnalysisStartData(BaseModel):
    run_id: uuid.UUID
    status: str
    message: str
    accepted_at: datetime


class RunStageData(BaseModel):
    stage: str
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None
    output: dict | None = None  # Stage output (e.g. skipped reason, blocked_reasons)


class RunDiagnosticsData(BaseModel):
    """Phase 7: Run-level diagnostics for observability and debug."""

    stage_durations: dict[str, float] = Field(default_factory=dict)
    failure_reason_codes: list[str] = Field(default_factory=list)
    evidence_accepted_count: int | None = None
    evidence_rejected_count: int | None = None
    assumption_valuation_ready: bool | None = None
    assumption_blocked_reasons: list[str] = Field(default_factory=list)
    valuation_skipped: bool = False
    valuation_readiness: bool | None = None
    report_degraded: bool = False
    report_quality_status: str | None = None
    report_quality_reason_codes: list[str] = Field(default_factory=list)
    report_quality_limitation_summary: list[str] = Field(default_factory=list)


class AnalysisStatusData(BaseModel):
    run_id: uuid.UUID
    company_id: uuid.UUID | None = None
    company_name: str | None = None
    orgnr: str | None = None
    created_at: datetime | None = None
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    current_stage: str
    stages: list[RunStageData] = Field(default_factory=list)
    error_message: str | None = None
    diagnostics: RunDiagnosticsData | None = None
    report_quality_status: str | None = None  # complete | complete_with_limitations | blocked | failed


class ReportGenerateRequest(BaseModel):
    run_id: uuid.UUID
    format: Literal["markdown", "json", "html"] = "markdown"


class ReportVersionData(BaseModel):
    report_version_id: uuid.UUID
    run_id: uuid.UUID
    status: Literal["draft", "review", "published", "archived"]
    title: str | None = None
    version_number: int | None = None


class ReportSectionData(BaseModel):
    section_key: str
    heading: str | None = None
    content_md: str
    sort_order: int


class ValidationStatusData(BaseModel):
    """Report-level validation status (lint, reconciliation)."""
    lint_passed: bool = True
    lint_warnings: list[str] = Field(default_factory=list)


class ReportDetailData(ReportVersionData):
    company_id: uuid.UUID | None = None
    company_name: str | None = None
    sections: list[ReportSectionData] = Field(default_factory=list)
    report_degraded: bool = False
    report_degraded_reasons: list[str] = Field(default_factory=list)
    report_quality_status: str | None = None  # complete | complete_with_limitations | blocked | failed
    report_quality_limitation_summary: list[str] = Field(default_factory=list)
    validation_status: ValidationStatusData | None = None


class ReportVersionSummary(BaseModel):
    report_version_id: uuid.UUID
    run_id: uuid.UUID
    version_number: int | None = None
    status: str
    title: str | None = None
    created_at: datetime | None = None


class ReportVersionListData(BaseModel):
    company_id: uuid.UUID
    versions: list[ReportVersionSummary] = Field(default_factory=list)


class CompanyWithReportData(BaseModel):
    company_id: uuid.UUID
    company_name: str
    latest_report_id: uuid.UUID | None = None
    latest_report_title: str | None = None
    updated_at: datetime | None = None
    run_count: int = 0


class CompetitorRequest(BaseModel):
    company_id: uuid.UUID
    top_n: int = Field(default=10, ge=1, le=50)


class CompetitorItem(BaseModel):
    competitor_id: uuid.UUID
    name: str
    relation_score: float | None = None
    website: str | None = None


class CompetitorListData(BaseModel):
    company_id: uuid.UUID
    items: list[CompetitorItem] = Field(default_factory=list)


class AddCompetitorRequest(BaseModel):
    company_id: uuid.UUID
    run_id: uuid.UUID
    competitor_name: str = Field(min_length=1, max_length=512)
    website: str | None = Field(default=None, max_length=2048)
    relation_score: float | None = Field(default=None, ge=0, le=1)


class UpdateCompetitorRequest(BaseModel):
    competitor_name: str | None = Field(default=None, min_length=1, max_length=512)
    website: str | None = Field(default=None, max_length=2048)
    relation_score: float | None = Field(default=None, ge=0, le=1)


class VerificationRequest(BaseModel):
    run_id: uuid.UUID
    strict_mode: bool = False


class VerificationData(BaseModel):
    verification_id: uuid.UUID
    run_id: uuid.UUID
    status: Literal["queued", "running", "completed", "failed"] = "queued"
    issues: list[str] = Field(default_factory=list)
    stats: dict = Field(default_factory=dict)


class SourceCreateRequest(BaseModel):
    run_id: uuid.UUID
    source_type: Literal["url", "document", "note", "database"]
    url: str | None = Field(default=None, max_length=2048)
    raw_text: str | None = Field(default=None, max_length=20000)

    @model_validator(mode="after")
    def validate_source_payload(self) -> "SourceCreateRequest":
        if self.source_type == "url" and not self.url:
            raise ValueError("url is required when source_type=url")
        if not self.url and not self.raw_text:
            raise ValueError("At least one of url or raw_text must be provided")
        return self


class SourceData(BaseModel):
    source_id: uuid.UUID
    run_id: uuid.UUID
    source_type: str
    status: Literal["accepted", "ingested"]
    title: str | None = None
    url: str | None = None
    chunk_count: int | None = None


class SearchCompanySourcesRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=512)
    orgnr: str | None = Field(default=None, min_length=4, max_length=32)
    company_id: uuid.UUID | None = None
    website: str | None = Field(default=None, max_length=2048)
    run_id: uuid.UUID | None = None
    max_results_per_query: int = Field(default=5, ge=1, le=20)
    max_queries: int = Field(default=3, ge=1, le=10)


class SearchCompanySourcesData(BaseModel):
    run_id: uuid.UUID
    company_id: uuid.UUID
    provider: str
    queries: list[str] = Field(default_factory=list)
    sources_stored: int
    chunks_stored: int
    skipped_urls: int
    warnings: list[str] = Field(default_factory=list)


class SourceListData(BaseModel):
    run_id: uuid.UUID
    items: list[SourceData] = Field(default_factory=list)


class RecomputeSectionRequest(BaseModel):
    report_version_id: uuid.UUID
    section_key: str = Field(min_length=1, max_length=128)
    instructions: str | None = Field(default=None, max_length=4000)


class RecomputeReportRequest(BaseModel):
    report_version_id: uuid.UUID
    include_sections: list[str] = Field(default_factory=list, max_length=32)
    reason: str | None = Field(default=None, max_length=2000)


class RecomputeData(BaseModel):
    job_id: uuid.UUID
    report_version_id: uuid.UUID
    status: Literal["queued", "running", "completed", "failed"] = "queued"


class HealthDependencyData(BaseModel):
    name: str
    enabled: bool
    healthy: bool | None = None
    message: str | None = None


class DeepResearchHealthData(BaseModel):
    service: str
    environment: str
    dependencies: list[HealthDependencyData]

