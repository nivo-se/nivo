# 03. Policy Framework

## Purpose

Policy objects define the fixed rules of the system.

They keep Nivo consistent across:
- sectors
- time
- model versions
- analysts
- environments

A report can vary in scope.
A policy should vary only through explicit versioning.

## Policy families

### 1. Valuation Policy
Defines deterministic valuation rules.

### 2. Multiples / Comp Policy
Defines peer selection and multiple normalization rules.

### 3. Evidence Policy
Defines source quality, recency, corroboration, and rejection rules.

### 4. Uncertainty Policy
Defines interval construction, confidence mapping, and scenario logic.

### 5. Privacy / Data Handling Policy
Defines what can be searched, cached, logged, or retained.

## Design principles

- policies are versioned
- policies are code-driven, not hidden prompts
- reports store policy versions used
- policy changes must be backward-compatible or explicitly migrated
- every policy should support auditability

## Valuation policy v1

### Required rule groups
- FCFF/WACC consistency
- FCFE/Cost of Equity consistency
- terminal growth ceiling
- tax-shield non-double-counting
- normalized cash flow definitions
- scenario interval propagation rules

### Example config shape

```yaml
valuation_policy:
  version: "dcf_v1"
  allowed_models:
    - dcf_fcff
    - trading_comps
  terminal_growth:
    max_relative_to_long_run_nominal_growth: true
    hard_cap_percent: 4.0
  consistency:
    require_fcff_with_wacc: true
    require_fcfe_with_cost_of_equity: true
  scenarios:
    required: true
    labels: ["bear", "base", "bull"]
```

## Multiples policy v1

### Required rule groups
- allowed multiples by company type
- trailing vs forward definition rules
- minimum peer count
- peer normalization requirements
- EBITDA normalization rules
- IFRS/GAAP comparability notes

### Example config shape

```yaml
comp_policy:
  version: "multiples_v1"
  allowed_multiples:
    software:
      - ev_revenue_forward
      - ev_ebitda_forward
    industrial:
      - ev_ebitda_ltm
      - p_e_ntm
  peer_rules:
    min_peer_count: 4
    require_uniform_definition: true
    require_reason_for_inclusion: true
```

## Evidence policy v1

### Required rule groups
- source hierarchy
- max source age by metric type
- min sources by metric type
- source diversity requirements
- conflict thresholds
- acceptance floor by score

### Example config shape

```yaml
evidence_policy:
  version: "evidence_v1"
  source_hierarchy:
    company_filing: 1.0
    regulator: 0.95
    official_statistics: 0.95
    peer_filing: 0.90
    industry_report: 0.75
    business_media: 0.65
    blog: 0.30
  metric_defaults:
    market_cagr_5y:
      min_sources: 2
      max_age_days: 365
      min_average_score: 0.70
    tam_current:
      min_sources: 2
      max_age_days: 365
      min_average_score: 0.70
```

## Uncertainty policy v1

### Required rule groups
- low/base/high construction
- confidence-to-interval widening
- fallback behavior
- insufficient evidence behavior

### Example config shape

```yaml
uncertainty_policy:
  version: "uncertainty_v1"
  interval_rules:
    default_mode: "low_base_high"
    widen_interval_when_conflicts_exist: true
    widen_interval_when_source_diversity_is_low: true
  fallback:
    allow_proxy_inputs: true
    require_proxy_labeling: true
    allow_manual_override: false
```

## Privacy gate policy v1

### Required rule groups
- PII masking
- query redaction
- retention windows
- cacheability rules
- vendor eligibility flags

### Example config shape

```yaml
privacy_policy:
  version: "privacy_v1"
  query_safety:
    redact_personal_emails: true
    redact_person_names_when_not_required: true
  retention:
    raw_search_sessions_days: 30
    validated_evidence_days: 365
  vendors:
    tavily_allowed: true
    firecrawl_allowed: true
```

## Storage and versioning

Recommended path:

```text
backend/config/policies/
  valuation_policy.dcf_v1.yaml
  comp_policy.multiples_v1.yaml
  evidence_policy.evidence_v1.yaml
  uncertainty_policy.uncertainty_v1.yaml
  privacy_policy.privacy_v1.yaml
```

## Runtime policy loading

The orchestrator should:
1. load policy versions from `report_spec`
2. materialize them into typed policy objects
3. attach them to run context
4. log policy versions into persistence
5. include versions in final report metadata

## Non-goals for v1

Do not build:
- a UI for arbitrary policy editing
- analyst-specific hidden overrides
- self-modifying policy logic

Keep policy strict and centralized.
