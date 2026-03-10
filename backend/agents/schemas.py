"""Structured schemas for core research agent outputs."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class SourceEvidence(BaseModel):
    source_id: uuid.UUID | None = None
    source_chunk_id: uuid.UUID | None = None
    source_url: str | None = None
    source_title: str | None = None
    excerpt: str | None = None


class AgentClaim(BaseModel):
    claim_text: str = Field(min_length=5, max_length=2000)
    claim_type: str = Field(min_length=2, max_length=64)
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    evidence: SourceEvidence = Field(default_factory=SourceEvidence)
    verified: bool = False


class IdentityAgentOutput(BaseModel):
    agent: Literal["identity"] = "identity"
    canonical_name: str | None = None
    orgnr: str | None = None
    website: str | None = None
    headquarters: str | None = None
    industry: str | None = None
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CompanyProfileAgentOutput(BaseModel):
    """Canonical company understanding payload per FINAL_DEEP_RESEARCH_ARCHITECTURE.md Layer 3."""

    agent: Literal["company_profile"] = "company_profile"
    summary: str
    business_model: str | None = None
    products_services: list[str] = Field(default_factory=list)
    customer_segments: list[str] = Field(default_factory=list)
    geographies: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    # First-class company understanding fields (for QueryPlanner, gating, debug)
    company_description: str | None = None
    market_niche: str | None = None
    confidence_score: float | None = None
    source_refs: list[dict] = Field(default_factory=list)


class TransactionRecord(BaseModel):
    """Single precedent transaction per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 5."""

    target: str = ""
    buyer: str = ""
    year: str | int | None = None
    enterprise_value: str | float | None = None
    ebitda: str | float | None = None
    ev_ebitda_multiple: str | float | None = None
    source_url: str | None = None


class TransactionAgentOutput(BaseModel):
    """Transaction discovery output per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 5."""

    agent: Literal["transaction"] = "transaction"
    transactions: list[TransactionRecord] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ProductAgentOutput(BaseModel):
    """Product intelligence per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 4."""

    agent: Literal["product"] = "product"
    product_categories: list[str] = Field(default_factory=list)
    pricing_position: str | None = None
    brand_positioning: str | None = None
    differentiators: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    sources: list[dict] = Field(default_factory=list)


class MarketAnalysisAgentOutput(BaseModel):
    agent: Literal["market_analysis"] = "market_analysis"
    market_size: str | None = None
    growth_rate: str | None = None
    trends: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CompetitorCandidate(BaseModel):
    name: str = Field(min_length=2, max_length=512)
    website: str | None = None
    relation_score: float = Field(ge=0.0, le=1.0, default=0.5)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    # Workstream 3: evidence-backed candidate classification
    candidate_type: Literal["direct", "adjacent", "substitute"] | None = None
    inclusion_rationale: str | None = None
    evidence_refs: list[dict] = Field(default_factory=list)


class CompetitorDiscoveryAgentOutput(BaseModel):
    agent: Literal["competitor_discovery"] = "competitor_discovery"
    competitors: list[CompetitorCandidate] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CompetitorProfileData(BaseModel):
    name: str = Field(min_length=2, max_length=512)
    profile_text: str | None = None
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    differentiation: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CompetitorProfilingAgentOutput(BaseModel):
    agent: Literal["competitor_profiling"] = "competitor_profiling"
    profiles: list[CompetitorProfileData] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class StrategyAnalysisAgentOutput(BaseModel):
    agent: Literal["strategy_analysis"] = "strategy_analysis"
    investment_thesis: str
    acquisition_rationale: str
    key_risks: list[str] = Field(default_factory=list)
    diligence_focus: list[str] = Field(default_factory=list)
    integration_themes: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ValueCreationIdentificationAgentOutput(BaseModel):
    agent: Literal["value_creation_identification"] = "value_creation_identification"
    initiatives: list[str] = Field(default_factory=list)
    timeline: list[str] = Field(default_factory=list)
    kpis: list[str] = Field(default_factory=list)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class FinancialModelingAgentOutput(BaseModel):
    agent: Literal["financial_modeling"] = "financial_modeling"
    model_version: str = "deterministic_v1"
    assumption_set: dict = Field(default_factory=dict)
    forecast: dict = Field(default_factory=dict)
    sensitivity: dict = Field(default_factory=dict)
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ValuationAnalysisAgentOutput(BaseModel):
    agent: Literal["valuation_analysis"] = "valuation_analysis"
    method: str = "deterministic_dcf"
    enterprise_value: float | None = None
    equity_value: float | None = None
    valuation_range_low: float | None = None
    valuation_range_high: float | None = None
    currency: str = "SEK"
    source_ids: list[uuid.UUID] = Field(default_factory=list)
    claims: list[AgentClaim] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

