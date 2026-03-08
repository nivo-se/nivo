"""Canonical AnalysisInput schema — single structured payload for model, valuation, and report."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class HistoricalYear:
    year: int
    revenue_msek: float | None = None
    ebitda_msek: float | None = None
    ebitda_margin_pct: float | None = None
    gross_profit_msek: float | None = None
    gross_margin_pct: float | None = None
    net_income_msek: float | None = None
    employees: int | None = None
    capex_msek: float | None = None
    nwc_msek: float | None = None


@dataclass(slots=True)
class DerivedFinancialHistory:
    revenue_cagr_pct: float | None = None
    ebitda_cagr_pct: float | None = None
    ebitda_margin_trend: list[float] = field(default_factory=list)
    gross_margin_trend: list[float] = field(default_factory=list)
    avg_capex_pct_revenue: float | None = None
    avg_nwc_pct_revenue: float | None = None
    fcf_conversion_pct: float | None = None
    latest_revenue_msek: float | None = None
    latest_ebitda_margin_pct: float | None = None


@dataclass(slots=True)
class MarketInput:
    market_label: str | None = None
    niche_label: str | None = None
    market_size: str | None = None
    market_growth_base: float | None = None
    market_growth_low: float | None = None
    market_growth_high: float | None = None
    key_trends: list[str] = field(default_factory=list)
    customer_segments: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    source_confidence: float | None = None


@dataclass(slots=True)
class CompetitorInput:
    name: str = ""
    website: str | None = None
    comparable_type: str | None = None
    relation_score: float | None = None
    revenue_msek: float | None = None
    ebitda_margin_pct: float | None = None
    growth_pct: float | None = None
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    differentiation: list[str] = field(default_factory=list)


@dataclass(slots=True)
class StrategyInput:
    investment_thesis: str | None = None
    acquisition_rationale: str | None = None
    key_risks: list[str] = field(default_factory=list)
    diligence_focus: list[str] = field(default_factory=list)
    integration_themes: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ValueCreationInitiative:
    description: str = ""
    rationale: str | None = None
    impact_assumption: str | None = None
    dependencies: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)


@dataclass(slots=True)
class VerificationSummary:
    verified: bool = False
    total_claims: int = 0
    supported: int = 0
    unsupported: int = 0
    uncertain: int = 0
    per_type: dict[str, dict[str, int]] = field(default_factory=dict)


@dataclass(slots=True)
class SourceRef:
    source_id: str = ""
    title: str | None = None
    url: str | None = None
    source_type: str = "unknown"
    provenance: str | None = None


@dataclass(slots=True)
class ModelAssumptions:
    base_year: int | None = None
    projection_years: int = 3
    starting_revenue_msek: float | None = None
    growth_start: float | None = None
    growth_terminal: float | None = None
    ebitda_margin_start: float | None = None
    ebitda_margin_terminal: float | None = None
    capex_pct_revenue: float | None = None
    nwc_pct_revenue: float | None = None
    discount_rate_wacc: float | None = None
    terminal_growth: float | None = None
    net_debt_msek: float | None = None
    scenario_names: list[str] = field(default_factory=lambda: ["base", "upside", "downside"])


@dataclass(slots=True)
class ProjectionRow:
    year: int = 0
    revenue_msek: float = 0.0
    growth_pct: float = 0.0
    ebitda_margin_pct: float = 0.0
    ebitda_msek: float = 0.0
    fcf_msek: float = 0.0


@dataclass(slots=True)
class ValuationOutput:
    method: str = "deterministic_dcf"
    enterprise_value_msek: float | None = None
    equity_value_msek: float | None = None
    valuation_range_low_msek: float | None = None
    valuation_range_high_msek: float | None = None
    net_debt_msek: float | None = None
    scenario_valuations: dict[str, dict] = field(default_factory=dict)


@dataclass(slots=True)
class AnalysisInput:
    """Single canonical payload containing everything the analysis/report layer needs."""

    run_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None

    # Company identity
    canonical_name: str = ""
    orgnr: str | None = None
    website: str | None = None
    industry: str | None = None
    headquarters: str | None = None

    # Company profile
    summary: str | None = None
    business_model: str | None = None
    products_services: list[str] = field(default_factory=list)
    customer_segments_profile: list[str] = field(default_factory=list)
    geographies: list[str] = field(default_factory=list)

    # Historical financials (up to 4 years, sorted oldest-first)
    historical_financials: list[HistoricalYear] = field(default_factory=list)
    derived_financial_history: DerivedFinancialHistory = field(default_factory=DerivedFinancialHistory)

    # Market
    market: MarketInput = field(default_factory=MarketInput)

    # Competitors
    competitors: list[CompetitorInput] = field(default_factory=list)

    # Strategy
    strategy: StrategyInput = field(default_factory=StrategyInput)

    # Value creation
    value_creation_initiatives: list[ValueCreationInitiative] = field(default_factory=list)

    # Verification summary
    verification: VerificationSummary = field(default_factory=VerificationSummary)

    # Source refs
    source_refs: list[SourceRef] = field(default_factory=list)
    proprietary_source_count: int = 0

    # Model assumptions (populated by AssumptionsEngine or assembler)
    model_assumptions: ModelAssumptions = field(default_factory=ModelAssumptions)

    # Projection outputs (populated after financial model runs)
    projections: dict[str, list[ProjectionRow]] = field(default_factory=dict)

    # Valuation output
    valuation_output: ValuationOutput = field(default_factory=ValuationOutput)

    # Stage flags for downstream validators (set by assembler guards)
    stage_flags: dict[str, bool] = field(default_factory=dict)

    def to_debug_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-safe dict for debug dumps."""
        import dataclasses
        def _convert(obj: Any) -> Any:
            if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
                return {k: _convert(v) for k, v in dataclasses.asdict(obj).items()}
            if isinstance(obj, uuid.UUID):
                return str(obj)
            if isinstance(obj, list):
                return [_convert(x) for x in obj]
            if isinstance(obj, dict):
                return {str(k): _convert(v) for k, v in obj.items()}
            return obj
        return _convert(self)


# ---------------------------------------------------------------------------
# Per-section required-field checklists (used by InputCompletenessValidator)
# ---------------------------------------------------------------------------

SECTION_REQUIREMENTS: dict[str, list[str]] = {
    "company": [
        "canonical_name",
        "business_model",
        "products_services",
        "geographies",
    ],
    "market": [
        "market.market_label",
        "market.market_growth_base",
        "market.key_trends",
    ],
    "competition": [
        "competitors",
    ],
    "value_creation": [
        "value_creation_initiatives",
    ],
    "financial": [
        "historical_financials",
        "derived_financial_history.latest_revenue_msek",
        "model_assumptions.starting_revenue_msek",
    ],
    "valuation": [
        "valuation_output.enterprise_value_msek",
    ],
}
