# 04. Evidence and Assumption Registry

## Purpose

This document defines the canonical data contracts for:
- evidence items
- evidence bundles
- assumption items
- assumption registry
- promotion rules from evidence to assumptions

This is the most important bridge between research and valuation.

## Part A: Evidence model

### Evidence item

Every evidence item should be a structured object.

```yaml
evidence_item:
  id: "uuid"
  metric_key: "market_cagr_5y"
  claim: "The Nordic workflow automation market is expected to grow at 11.8% CAGR from 2026 to 2030."
  value: 11.8
  unit: "percent"
  definition: "5-year CAGR for defined market segment"
  scope:
    geography: "Nordics"
    segment: "workflow automation software"
    period: "2026-2030"
  source:
    url: "https://..."
    title: "Example report"
    domain: "example.com"
    source_type: "industry_report"
    published_at: "2026-02-01"
    retrieved_at: "2026-03-13T09:00:00Z"
  extraction:
    supporting_text: "Quoted or extracted passage"
    page_ref: 12
    extractor: "firecrawl_pdf_v1"
  scores:
    relevance_score: 0.92
    authority_score: 0.75
    freshness_score: 0.90
    specificity_score: 0.85
    overall_score: 0.86
  validation:
    status: "validated"
    conflict_group_id: "uuid-or-null"
    notes: []
```

## Evidence bundle

A research run should persist evidence as bundles, not as detached snippets.

```yaml
validated_evidence_bundle:
  company_id: "..."
  report_id: "..."
  generated_at: "..."
  items: []
  rejected_items: []
  conflict_log: []
  coverage_summary:
    required_metrics_total: 12
    required_metrics_covered: 9
    coverage_rate: 0.75
```

## Part B: Assumption model

An assumption is not just a number.
It is a valuation-grade parameter object derived from evidence.

```yaml
assumption_item:
  id: "uuid"
  key: "market_cagr_5y"
  category: "market_growth"
  definition: "5-year CAGR for defined market segment"
  unit: "percent"
  scope:
    geography: "Nordics"
    segment: "workflow automation software"
    period: "2026-2030"
  point_estimates:
    low: 8.5
    base: 11.8
    high: 14.2
  confidence_score: 0.77
  derivation_method: "conflict_resolved_interval"
  evidence_refs:
    - "evidence-id-1"
    - "evidence-id-2"
  policy_refs:
    evidence_policy_version: "evidence_v1"
    uncertainty_policy_version: "uncertainty_v1"
  status: "accepted"
  notes:
    - "Built from two corroborating sources."
```

## Assumption registry

```yaml
assumption_registry:
  report_id: "..."
  version: "ar_v1"
  assumptions:
    - {}
  completeness:
    required_total: 10
    accepted_total: 8
    missing_keys:
      - peer_margin_benchmark
      - terminal_growth_proxy
  readiness:
    valuation_ready: false
    blocked_reasons:
      - "terminal_growth_proxy missing"
```

## Promotion rules

Evidence may be promoted to assumptions only if:
- it matches the required metric definition
- it passes minimum score thresholds
- it passes scope checks
- it has provenance
- conflict state is acceptable
- interval construction is possible

## Promotion classes

### Direct promotion
Used when evidence is strong and unambiguous.

### Resolved promotion
Used when multiple evidence items are merged into one interval.

### Proxy promotion
Used only when policy allows proxy assumptions.
Must be labeled clearly.

### Rejected promotion
Used when evidence is too weak, stale, mismatched, or conflicting.

## Required assumption families

### Market assumptions
- market_cagr_5y
- tam_current
- market_fragmentation_signal

### Operating assumptions
- revenue_growth_path
- margin_path
- capex_intensity
- nwc_intensity

### Valuation assumptions
- terminal_growth
- discount_rate_inputs
- peer_multiple_range

## Confidence strategy

Confidence score should combine:
- evidence quality
- source diversity
- recency
- conflict severity
- metric difficulty

## Insufficient evidence behavior

If a required assumption cannot be built:
- log the gap
- expose the blocker in UX
- mark valuation readiness false
- do not silently substitute made-up values

## Suggested implementation modules

```text
backend/services/deep_research/evidence_extractor.py
backend/services/deep_research/evidence_scorer.py
backend/services/deep_research/evidence_verifier.py
backend/services/deep_research/assumption_registry_builder.py
backend/orchestrator/persistence.py
```
