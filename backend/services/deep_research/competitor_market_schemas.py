"""Structured schemas for Workstream 3: Competitor Intelligence + Market Synthesis."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Competitor pipeline
# ---------------------------------------------------------------------------

CandidateType = Literal["direct", "adjacent", "substitute"]
VerificationStatus = Literal[
    "verified_direct",
    "verified_adjacent",
    "substitute",
    "weak_candidate",
    "rejected",
]


class EvidenceRef(BaseModel):
    """Reference to a validated evidence item."""

    web_evidence_id: uuid.UUID | None = None
    source_url: str | None = None
    source_id: uuid.UUID | None = None
    excerpt: str | None = None


class CompetitorCandidateW3(BaseModel):
    """Workstream 3 competitor candidate with evidence-backed rationale."""

    name: str = Field(min_length=2, max_length=512)
    website: str | None = None
    candidate_type: CandidateType = "adjacent"
    inclusion_rationale: str = Field(min_length=1, max_length=2000)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    relation_score: float = Field(ge=0.0, le=1.0, default=0.5)
    metadata: dict = Field(default_factory=dict)


class VerifiedCompetitor(BaseModel):
    """Competitor after verification; may be accepted or rejected."""

    name: str = Field(min_length=2, max_length=512)
    website: str | None = None
    verification_status: VerificationStatus
    rejection_reason: str | None = None
    overlap_scores: dict[str, float] = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CompetitorProfileW3(BaseModel):
    """Canonical competitor profile for downstream strategy/valuation."""

    company_name: str = Field(min_length=2, max_length=512)
    description: str | None = None
    product_focus: list[str] = Field(default_factory=list)
    target_customers: list[str] = Field(default_factory=list)
    geographies: list[str] = Field(default_factory=list)
    business_model: str | None = None
    positioning_summary: str | None = None
    estimated_scale_signal: str | None = None
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    profile_confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    verification_status: VerificationStatus = "verified_adjacent"
    metadata: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Market model
# ---------------------------------------------------------------------------


class MarketModel(BaseModel):
    """Structured market model from validated evidence."""

    market_label: str = Field(min_length=1, max_length=256)
    market_subsegment: str | None = None
    geography_scope: str | None = None
    customer_segment: str | None = None
    buying_model: str | None = None
    demand_drivers: list[str] = Field(default_factory=list)
    market_growth_signal: str | None = None
    concentration_signal: str | None = None
    fragmentation_signal: str | None = None
    market_maturity_signal: str | None = None
    cyclicality_signal: str | None = None
    regulatory_signal: str | None = None
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
    metadata: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Positioning analysis
# ---------------------------------------------------------------------------


class PositioningAnalysis(BaseModel):
    """Target company vs verified competitors on key axes."""

    differentiated_axes: list[str] = Field(default_factory=list)
    parity_axes: list[str] = Field(default_factory=list)
    disadvantage_axes: list[str] = Field(default_factory=list)
    unclear_axes: list[str] = Field(default_factory=list)
    positioning_summary: str | None = None
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Market synthesis
# ---------------------------------------------------------------------------


class MarketSynthesis(BaseModel):
    """Evidence-backed synthesis for downstream strategy and valuation."""

    market_attractiveness_score: float = Field(ge=0.0, le=1.0, default=0.5)
    competition_intensity_score: float = Field(ge=0.0, le=1.0, default=0.5)
    niche_defensibility_score: float = Field(ge=0.0, le=1.0, default=0.5)
    growth_support_score: float = Field(ge=0.0, le=1.0, default=0.5)
    synthesis_summary: str = Field(min_length=1, max_length=4000)
    key_supporting_claims: list[str] = Field(default_factory=list)
    key_uncertainties: list[str] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
    metadata: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Combined output for orchestrator node
# ---------------------------------------------------------------------------


class CompetitorMarketSynthesisOutput(BaseModel):
    """Combined output from the competitor_market_synthesis pipeline node."""

    candidates: list[CompetitorCandidateW3] = Field(default_factory=list)
    verified_competitors: list[VerifiedCompetitor] = Field(default_factory=list)
    competitor_profiles: list[CompetitorProfileW3] = Field(default_factory=list)
    market_model: MarketModel | None = None
    positioning_analysis: PositioningAnalysis | None = None
    market_synthesis: MarketSynthesis | None = None
    metadata: dict = Field(default_factory=dict)
