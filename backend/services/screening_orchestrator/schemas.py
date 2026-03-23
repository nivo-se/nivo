"""Pydantic models for screening campaign API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CampaignParams(BaseModel):
    """Tunables for campaign execution."""

    layer0_limit: int = Field(default=20, alias="layer0Limit", ge=1, le=50_000)
    max_universe_candidates: int = Field(
        default=500,
        alias="maxUniverseCandidates",
        ge=1,
        le=50_000,
        description="After ranking by profile score, cap the ranked pool before taking layer0_limit (future use + stats transparency).",
    )
    layer1_limit: int = Field(default=800, alias="layer1Limit", ge=1, le=50_000)
    layer2_limit: int = Field(default=300, alias="layer2Limit", ge=1, le=50_000)
    final_shortlist_size: int = Field(default=100, alias="finalShortlistSize", ge=1, le=1000)
    policy: Dict[str, Any] = Field(default_factory=dict)
    score_weights: Dict[str, float] = Field(
        default_factory=lambda: {"deterministic": 0.4, "fit": 0.6},
        alias="scoreWeights",
    )

    model_config = {"populate_by_name": True}


class FilterItemPayload(BaseModel):
    field: str
    op: str
    value: Any
    type: str


class CreateCampaignBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    profile_id: str = Field(..., alias="profileId")
    profile_version_id: Optional[str] = Field(None, alias="profileVersionId")
    params: CampaignParams = Field(default_factory=CampaignParams)
    filters: List[FilterItemPayload] = Field(default_factory=list)
    exclude_filters: List[FilterItemPayload] = Field(default_factory=list, alias="excludeFilters")
    q: Optional[str] = None
    overrides: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class CampaignSummary(BaseModel):
    id: str
    name: str
    profile_id: str
    profile_version_id: Optional[str] = None
    status: str
    current_stage: Optional[str] = None
    stats_json: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"populate_by_name": True}


class CandidateRow(BaseModel):
    orgnr: str
    name: Optional[str] = None
    layer0_rank: Optional[int] = Field(None, alias="layer0Rank")
    profile_weighted_score: Optional[float] = Field(None, alias="profileWeightedScore")
    archetype_code: Optional[str] = Field(None, alias="archetypeCode")
    primary_nace: Optional[str] = Field(None, alias="primaryNace")
    excluded_from_analysis: bool = Field(False, alias="excludedFromAnalysis")
    exclusion_reason: Optional[str] = Field(None, alias="exclusionReason")

    model_config = {"populate_by_name": True}
