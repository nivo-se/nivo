# AnalysisInput Contract

This document defines the canonical `AnalysisInput` dataclass used throughout the Deep Research pipeline. All analysis, modeling, and report generation flows receive this single structured payload.

**Source file:** `backend/services/deep_research/analysis_input.py`

---

## Top-Level Identity Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `run_id` | `UUID` | Yes | Set during assembly |
| `company_id` | `UUID` | Yes | Deep research company ID |
| `canonical_name` | `str` | Yes | Resolved from identity agent or main DB |
| `orgnr` | `str` | Yes | Must be real (never `tmp-`) |
| `website` | `str` | Recommended | Homepage URL |
| `industry` | `str` | Recommended | From identity agent or NACE codes |
| `headquarters` | `str` | Optional | From identity agent |

---

## Company Profile Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `summary` | `str` | Recommended | Company overview narrative |
| `business_model` | `str` | Yes | Core business model description |
| `products_services` | `list[str]` | Yes | Key products and services |
| `customer_segments_profile` | `list[str]` | Optional | Customer segments from profile agent |
| `geographies` | `list[str]` | Yes | Operating geographies |

---

## Historical Financials

| Field | Type | Required | Quality Expectation |
|-------|------|----------|---------------------|
| `historical_financials` | `list[HistoricalYear]` | Yes | >= 3 years, sorted oldest-first |

### HistoricalYear

| Field | Type | Required |
|-------|------|----------|
| `year` | `int` | Yes |
| `revenue_msek` | `float` | Yes |
| `ebitda_msek` | `float` | Recommended |
| `ebitda_margin_pct` | `float` | Derived |
| `gross_profit_msek` | `float` | Optional |
| `gross_margin_pct` | `float` | Optional |
| `net_income_msek` | `float` | Optional |
| `employees` | `int` | Optional |
| `capex_msek` | `float` | Optional |
| `nwc_msek` | `float` | Optional |

### Integrity Checks (enforced by validator)

- `revenue_history` must not be entirely null
- `EBITDA` should not be entirely null (warning if so)
- Year sequence should be continuous (no gaps)
- At least 3 years present

---

## DerivedFinancialHistory

Computed from `historical_financials` during assembly.

| Field | Type | Notes |
|-------|------|-------|
| `revenue_cagr_pct` | `float` | Revenue compound annual growth |
| `ebitda_cagr_pct` | `float` | EBITDA compound annual growth |
| `ebitda_margin_trend` | `list[float]` | Margin per year |
| `gross_margin_trend` | `list[float]` | Gross margin per year |
| `avg_capex_pct_revenue` | `float` | Average capex as % of revenue |
| `avg_nwc_pct_revenue` | `float` | Average NWC as % of revenue |
| `fcf_conversion_pct` | `float` | Free cash flow conversion |
| `latest_revenue_msek` | `float` | Most recent year's revenue |
| `latest_ebitda_margin_pct` | `float` | Most recent year's EBITDA margin |

---

## MarketInput

| Field | Type | Required |
|-------|------|----------|
| `market_label` | `str` | Yes (threshold) |
| `niche_label` | `str` | Optional |
| `market_size` | `str` | Recommended |
| `market_growth_base` | `float` | Yes |
| `market_growth_low` | `float` | Optional |
| `market_growth_high` | `float` | Optional |
| `key_trends` | `list[str]` | Yes |
| `customer_segments` | `list[str]` | Optional |
| `risks` | `list[str]` | Optional |
| `source_confidence` | `float` | Optional |

---

## CompetitorInput

| Field | Type | Required |
|-------|------|----------|
| `name` | `str` | Yes |
| `website` | `str` | Optional |
| `comparable_type` | `str` | Optional |
| `relation_score` | `float` | Optional |
| `revenue_msek` | `float` | Optional |
| `ebitda_margin_pct` | `float` | Optional |
| `growth_pct` | `float` | Optional |
| `strengths` | `list[str]` | Optional |
| `weaknesses` | `list[str]` | Optional |
| `differentiation` | `list[str]` | Optional |

Threshold: at least 1 competitor required.

---

## StrategyInput

| Field | Type | Required |
|-------|------|----------|
| `investment_thesis` | `str` | Recommended |
| `acquisition_rationale` | `str` | Recommended |
| `key_risks` | `list[str]` | Recommended |
| `diligence_focus` | `list[str]` | Optional |
| `integration_themes` | `list[str]` | Optional |

---

## ValueCreationInitiative

| Field | Type | Required |
|-------|------|----------|
| `description` | `str` | Yes |
| `rationale` | `str` | Optional |
| `impact_assumption` | `str` | Optional |
| `dependencies` | `list[str]` | Optional |
| `risks` | `list[str]` | Optional |

---

## ModelAssumptions

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `base_year` | `int` | Recommended | None |
| `projection_years` | `int` | Yes | 3 |
| `starting_revenue_msek` | `float` | Yes (threshold) | None |
| `growth_start` | `float` | Recommended | None |
| `growth_terminal` | `float` | Recommended | None |
| `ebitda_margin_start` | `float` | Recommended | None |
| `ebitda_margin_terminal` | `float` | Recommended | None |
| `capex_pct_revenue` | `float` | Optional | None |
| `nwc_pct_revenue` | `float` | Optional | None |
| `discount_rate_wacc` | `float` | Optional | None |
| `terminal_growth` | `float` | Optional | None |
| `net_debt_msek` | `float` | Optional | None |
| `scenario_names` | `list[str]` | Yes | ["base", "upside", "downside"] |

---

## ValuationOutput

| Field | Type | Required |
|-------|------|----------|
| `method` | `str` | Yes (default: "deterministic_dcf") |
| `enterprise_value_msek` | `float` | Yes |
| `equity_value_msek` | `float` | Recommended |
| `valuation_range_low_msek` | `float` | Optional |
| `valuation_range_high_msek` | `float` | Optional |
| `net_debt_msek` | `float` | Optional |
| `scenario_valuations` | `dict` | Optional |

---

## Stage Flags

| Field | Type | Notes |
|-------|------|-------|
| `stage_flags` | `dict[str, bool]` | Set by assembler guards when data loading is skipped or degraded |

Known flags:
- `financials_skipped_tmp_orgnr` — financials skipped because orgnr was synthetic
- `financials_skipped_no_orgnr` — financials skipped because orgnr was missing

---

## Section Requirements (for completeness validator)

Defined in `SECTION_REQUIREMENTS`:

| Section | Required Fields |
|---------|----------------|
| company | `canonical_name`, `business_model`, `products_services`, `geographies` |
| market | `market.market_label`, `market.market_growth_base`, `market.key_trends` |
| competition | `competitors` |
| value_creation | `value_creation_initiatives` |
| financial | `historical_financials`, `derived_financial_history.latest_revenue_msek`, `model_assumptions.starting_revenue_msek` |
| valuation | `valuation_output.enterprise_value_msek` |
