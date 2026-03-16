"""SQLAlchemy ORM models for Deep Research persistence tables."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base, DEEP_RESEARCH_SCHEMA, TimestampMixin


class Company(TimestampMixin, Base):
    __tablename__ = "companies"
    __table_args__ = (
        UniqueConstraint("orgnr", name="uq_dr_companies_orgnr"),
        Index("ix_dr_companies_orgnr", "orgnr"),
        Index("ix_dr_companies_name", "name"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    orgnr: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    headquarters: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="company")


class AnalysisRun(TimestampMixin, Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed', 'cancelled')",
            name="ck_dr_analysis_runs_status",
        ),
        Index("ix_dr_analysis_runs_company_status", "company_id", "status"),
        Index("ix_dr_analysis_runs_created_at", "created_at"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[Any]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    company: Mapped[Optional["Company"]] = relationship(back_populates="analysis_runs")
    sources: Mapped[list["Source"]] = relationship(back_populates="analysis_run")
    node_states: Mapped[list["RunNodeState"]] = relationship(back_populates="analysis_run")


class RunNodeState(TimestampMixin, Base):
    __tablename__ = "run_node_states"
    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'completed', 'failed', 'skipped')",
            name="ck_dr_run_node_states_status",
        ),
        UniqueConstraint("run_id", "node_name", name="uq_dr_run_node_states_run_node"),
        Index("ix_dr_run_node_states_run_status", "run_id", "status"),
        Index("ix_dr_run_node_states_node_name", "node_name"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    node_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    started_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    input_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="node_states")


class Source(TimestampMixin, Base):
    __tablename__ = "sources"
    __table_args__ = (
        Index("ix_dr_sources_run_id", "run_id"),
        Index("ix_dr_sources_company_id", "company_id"),
        Index("ix_dr_sources_source_type", "source_type"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    published_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="sources")
    chunks: Mapped[list["SourceChunk"]] = relationship(back_populates="source")


class SourceChunk(TimestampMixin, Base):
    __tablename__ = "source_chunks"
    __table_args__ = (
        UniqueConstraint("source_id", "chunk_index", name="uq_dr_source_chunks_source_index"),
        Index("ix_dr_source_chunks_source", "source_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.sources.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    source: Mapped["Source"] = relationship(back_populates="chunks")


class Claim(TimestampMixin, Base):
    __tablename__ = "claims"
    __table_args__ = (
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_dr_claims_confidence",
        ),
        Index("ix_dr_claims_run_id", "run_id"),
        Index("ix_dr_claims_company_id", "company_id"),
        Index("ix_dr_claims_verified", "is_verified"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_chunk_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.source_chunks.id", ondelete="SET NULL"),
        nullable=True,
    )
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    claim_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ClaimVerification(TimestampMixin, Base):
    __tablename__ = "claim_verifications"
    __table_args__ = (
        Index("ix_dr_claim_verifications_run", "run_id"),
        Index("ix_dr_claim_verifications_claim", "claim_id"),
        Index("ix_dr_claim_verifications_status", "status"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.claims.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    verified_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=datetime.utcnow
    )
    source_ids: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CompanyProfile(TimestampMixin, Base):
    __tablename__ = "company_profiles"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_company_profiles_run_company"),
        Index("ix_dr_company_profiles_company_id", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    products_services: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    customer_segments: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    geographies: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class MarketAnalysis(TimestampMixin, Base):
    __tablename__ = "market_analysis"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_market_analysis_run_company"),
        Index("ix_dr_market_analysis_company_id", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    market_size: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    growth_rate: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    trends: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    risks: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    opportunities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class Competitor(TimestampMixin, Base):
    __tablename__ = "competitors"
    __table_args__ = (
        Index("ix_dr_competitors_run_company", "run_id", "company_id"),
        Index("ix_dr_competitors_name", "competitor_name"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    competitor_name: Mapped[str] = mapped_column(String(512), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    relation_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    profiles: Mapped[list["CompetitorProfile"]] = relationship(back_populates="competitor")


class CompetitorProfile(TimestampMixin, Base):
    __tablename__ = "competitor_profiles"
    __table_args__ = (
        UniqueConstraint("competitor_id", name="uq_dr_competitor_profiles_competitor"),
        Index("ix_dr_competitor_profiles_competitor", "competitor_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    competitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.competitors.id", ondelete="CASCADE"),
        nullable=False,
    )
    profile_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strengths: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    weaknesses: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    differentiation: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    competitor: Mapped["Competitor"] = relationship(back_populates="profiles")


class Strategy(TimestampMixin, Base):
    __tablename__ = "strategy"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_strategy_run_company"),
        Index("ix_dr_strategy_company_id", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    investment_thesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acquisition_rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_risks: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    diligence_focus: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    integration_themes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class ValueCreation(TimestampMixin, Base):
    __tablename__ = "value_creation"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_value_creation_run_company"),
        Index("ix_dr_value_creation_company_id", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.strategy.id", ondelete="CASCADE"),
        nullable=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    initiatives: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timeline: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    kpis: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class FinancialModel(TimestampMixin, Base):
    __tablename__ = "financial_models"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "company_id",
            "model_version",
            name="uq_dr_financial_models_run_company_version",
        ),
        Index("ix_dr_financial_models_company_id", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_version: Mapped[str] = mapped_column(String(64), nullable=False, default="v1")
    assumption_set: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    forecast: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sensitivity: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class Valuation(TimestampMixin, Base):
    __tablename__ = "valuations"
    __table_args__ = (
        Index("ix_dr_valuations_company_method", "company_id", "method"),
        Index("ix_dr_valuations_run_id", "run_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    financial_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.financial_models.id", ondelete="SET NULL"),
        nullable=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    method: Mapped[str] = mapped_column(String(64), nullable=False)
    enterprise_value: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    equity_value: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    valuation_range_low: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 2), nullable=True
    )
    valuation_range_high: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="SEK")
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class ReportVersion(TimestampMixin, Base):
    __tablename__ = "report_versions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'review', 'published', 'archived')",
            name="ck_dr_report_versions_status",
        ),
        UniqueConstraint(
            "run_id", "company_id", "version_number", name="uq_dr_report_versions_run_company"
        ),
        Index("ix_dr_report_versions_run_status", "run_id", "status"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    generated_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    sections: Mapped[list["ReportSection"]] = relationship(back_populates="report_version")


class ReportSection(TimestampMixin, Base):
    __tablename__ = "report_sections"
    __table_args__ = (
        UniqueConstraint(
            "report_version_id", "section_key", name="uq_dr_report_sections_version_key"
        ),
        Index("ix_dr_report_sections_version_order", "report_version_id", "sort_order"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.report_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    section_key: Mapped[str] = mapped_column(String(128), nullable=False)
    heading: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    report_version: Mapped["ReportVersion"] = relationship(back_populates="sections")


class WebSearchSession(TimestampMixin, Base):
    __tablename__ = "web_search_sessions"
    __table_args__ = (
        Index("ix_dr_web_search_sessions_run", "run_id"),
        Index("ix_dr_web_search_sessions_company", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    query_group: Mapped[str] = mapped_column(String(64), nullable=False)
    queries: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="tavily")
    extra: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class WebEvidence(TimestampMixin, Base):
    __tablename__ = "web_evidence"
    __table_args__ = (
        Index("ix_dr_web_evidence_run", "run_id"),
        Index("ix_dr_web_evidence_company", "company_id"),
        Index("ix_dr_web_evidence_session", "session_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.web_search_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    claim_type: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    source_title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    source_domain: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    source_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    retrieved_at: Mapped[Optional[Any]] = mapped_column(DateTime(timezone=True), nullable=True)
    supporting_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    verification_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class WebEvidenceRejected(TimestampMixin, Base):
    __tablename__ = "web_evidence_rejected"
    __table_args__ = (
        Index("ix_dr_web_evidence_rejected_run", "run_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    evidence_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    rejection_reason: Mapped[str] = mapped_column(Text, nullable=False)
    rejected_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )


class CompetitorCandidate(TimestampMixin, Base):
    """Workstream 3: competitor candidates with verification status."""

    __tablename__ = "competitor_candidates"
    __table_args__ = (
        Index("ix_dr_competitor_candidates_run", "run_id"),
        Index("ix_dr_competitor_candidates_company", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_name: Mapped[str] = mapped_column(Text, nullable=False)
    candidate_type: Mapped[str] = mapped_column(String(32), nullable=False, default="adjacent")
    inclusion_rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_refs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    verification_status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending")
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MarketModel(TimestampMixin, Base):
    """Workstream 3: structured market model from validated evidence."""

    __tablename__ = "market_models"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_market_models_run_company"),
        Index("ix_dr_market_models_run", "run_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    market_label: Mapped[str] = mapped_column(Text, nullable=False)
    market_subsegment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geography_scope: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_segment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    buying_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    demand_drivers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    market_growth_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    concentration_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fragmentation_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    market_maturity_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cyclicality_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    regulatory_signal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_refs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class PositioningAnalysis(TimestampMixin, Base):
    """Workstream 3: target vs competitors positioning analysis."""

    __tablename__ = "positioning_analyses"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_positioning_analyses_run_company"),
        Index("ix_dr_positioning_analyses_run", "run_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    differentiated_axes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    parity_axes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    disadvantage_axes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    unclear_axes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    positioning_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_refs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MarketSynthesis(TimestampMixin, Base):
    """Workstream 3: evidence-backed market synthesis."""

    __tablename__ = "market_syntheses"
    __table_args__ = (
        UniqueConstraint("run_id", "company_id", name="uq_dr_market_syntheses_run_company"),
        Index("ix_dr_market_syntheses_run", "run_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    market_attractiveness_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    competition_intensity_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    niche_defensibility_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    growth_support_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    synthesis_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_supporting_claims: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    key_uncertainties: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    evidence_refs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ReportSpecPersistence(TimestampMixin, Base):
    """V2: Machine-readable report spec per run (docs/deep_research/tightning/02-report-spec-schema)."""

    __tablename__ = "report_specs"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_dr_report_specs_run"),
        Index("ix_dr_report_specs_run", "run_id"),
        Index("ix_dr_report_specs_company", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    run_mode: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="standard_deep_research",
    )
    spec_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    policy_versions_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class EvidenceBundlePersistence(TimestampMixin, Base):
    """V2: Validated evidence bundle per run (docs/deep_research/tightning/04-evidence-and-assumption-registry)."""

    __tablename__ = "evidence_bundles"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_dr_evidence_bundles_run"),
        Index("ix_dr_evidence_bundles_run", "run_id"),
        Index("ix_dr_evidence_bundles_company", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    bundle_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    coverage_summary_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AssumptionRegistryPersistence(TimestampMixin, Base):
    """V2: Assumption registry per run (docs/deep_research/tightning/04-evidence-and-assumption-registry)."""

    __tablename__ = "assumption_registries"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_dr_assumption_registries_run"),
        Index("ix_dr_assumption_registries_run", "run_id"),
        Index("ix_dr_assumption_registries_company", "company_id"),
        {"schema": DEEP_RESEARCH_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DEEP_RESEARCH_SCHEMA}.companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    registry_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    completeness_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    readiness_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
