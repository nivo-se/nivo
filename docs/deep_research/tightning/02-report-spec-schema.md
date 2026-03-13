# 02. Report Spec Schema

## Purpose

`report_spec` is the machine-readable contract for a research run.

It tells the system:
- what the report is trying to answer
- which parameters are required
- how those parameters are defined
- which source types are acceptable
- which policies apply
- how uncertainty should be expressed

Without `report_spec`, retrieval and valuation become too loose and inconsistent.

## Design goals

The schema must:
- be compact enough for every run
- be expressive enough for cross-industry use
- remain mostly backend-controlled
- support user-selected modes like Quick / Standard / Full
- drive retrieval, gating, and report assembly

## Canonical top-level shape

```yaml
report_spec:
  report_id: "uuid"
  company:
    company_id: "internal-id"
    legal_name: "Example AB"
    org_number: "556xxx-xxxx"
    website: "https://example.com"
    country: "SE"
    currency: "SEK"
  run_mode: "standard_deep_research"
  analyst_context:
    note: "Assess whether this is a fragmented niche with room for professionalization."
  research_scope:
    primary_question: "Is this company attractive for Nivo's buy-and-build thesis?"
    geography_scope: ["Sweden", "Nordics"]
    industry_scope: ["B2B software", "workflow automation"]
    time_horizon_years: 5
  required_outputs:
    - company_profile
    - market_model
    - competitor_set
    - assumption_registry
    - valuation_output
  required_metrics:
    - key: market_cagr_5y
      definition: "5-year CAGR for the defined market segment"
      unit: "percent"
      geography: "Nordics"
      period: "2026-2030"
      min_sources: 2
      max_source_age_days: 365
    - key: tam_current
      definition: "Current TAM for the same market segment"
      unit: "SEKm"
      geography: "Nordics"
      year: 2026
      min_sources: 2
  policy_versions:
    valuation_policy_version: "dcf_v1"
    comp_policy_version: "multiples_v1"
    evidence_policy_version: "evidence_v1"
    uncertainty_policy_version: "uncertainty_v1"
  acceptance_rules:
    require_market_niche: true
    minimum_average_evidence_score: 0.70
    require_verified_market_evidence: true
    require_source_diversity: true
  output_preferences:
    include_valuation: true
    include_citations: true
    include_scenarios: true
    preferred_language: "en"
```

## Required sections

### 1. Company
The target entity and known identifiers.

### 2. Run mode
Examples:
- `quick_screen`
- `standard_deep_research`
- `full_ic_prep`

### 3. Research scope
Defines the main analytical frame:
- thesis type
- market/geography
- time horizon
- special constraints

### 4. Required outputs
Lets the system skip or include stages deterministically.

### 5. Required metrics
The most important part. These are parameter requests, not general topics.

Each metric definition should include:
- `key`
- `definition`
- `unit`
- `scope`
- `time period`
- `minimum sources`
- `maximum source age`
- optional source hierarchy overrides

### 6. Policy versions
Locks reproducibility.

### 7. Acceptance rules
Controls stage gating and report strictness.

### 8. Output preferences
Controls formatting and optional sections, not research truth.

## Minimal v1 schema

For v1, keep the schema intentionally tight:

```yaml
report_spec:
  company: {}
  run_mode: ""
  research_scope: {}
  required_metrics: []
  policy_versions: {}
  acceptance_rules: {}
```

## Recommended generation approach

### Inputs to spec builder
- user-selected company
- run mode
- analyst note
- company profile
- available financial history

### Generation strategy
1. start from mode template
2. enrich with company profile
3. infer likely market scope
4. attach required metric set
5. attach policy versions
6. return spec + readiness warnings

## Readiness warnings

The spec builder should be allowed to return warnings like:
- website missing
- market niche unclear
- limited public coverage expected
- valuation may be low-confidence
- peer comparability likely weak

These warnings should surface in both UX and run metadata.

## Example required metric catalog

### Market
- `market_cagr_5y`
- `tam_current`
- `sam_current`
- `market_fragmentation_signal`
- `regulatory_signal`

### Competitor
- `direct_competitor_count`
- `peer_growth_benchmark`
- `peer_margin_benchmark`

### Valuation
- `terminal_growth_proxy`
- `wacc_proxy_inputs`
- `ev_ebitda_peer_range`
- `ev_revenue_peer_range`

## Validation rules

A valid `report_spec` must have:
- company identity
- at least one required output
- at least one required metric when valuation is included
- explicit policy versions
- explicit run mode

## Suggested file paths

```text
backend/services/deep_research/report_spec_builder.py
backend/agents/schemas.py
docs/deep_research/examples/report_spec.example.yaml
```
