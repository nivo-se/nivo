# 01. Target Architecture

## Objective

Upgrade Nivo from a loosely coupled deep research workflow into a controlled, reproducible `research-to-valuation` pipeline.

The architecture must:
- remain tight and shippable
- improve repeatability across industries
- preserve evidence provenance
- prevent LLM drift in valuation logic
- surface uncertainty explicitly
- support staged gating and partial reruns

## North-star flow

```text
User Intent
  -> ReportSpec
  -> Query Plan
  -> Retrieval + Extraction
  -> Validated Evidence Bundle
  -> Assumption Registry
  -> Deterministic Valuation Engine
  -> Final Report Assembly
```

## Canonical runtime stages

### Stage 0: Company Resolution
Resolve legal entity, org number, website, geography, currency, and internal company ID.

**Outputs**
- `company_resolution`
- `data_availability_summary`

### Stage 1: Financial Grounding
Load historical financials and compute derived metrics.

**Outputs**
- `historical_financials`
- `derived_metrics`
- `financial_quality_flags`

### Stage 2: Company Understanding
Build canonical company profile with structured fields.

**Outputs**
- `company_profile`
  - company_description
  - products_services
  - business_model
  - target_customers
  - geographies
  - market_niche
  - pricing_model
  - channel_model
  - confidence_by_field

### Stage 3: Report Spec Construction
Create a machine-readable scope contract for the run.

**Outputs**
- `report_spec`

### Stage 4: Query Compilation
Translate the report spec into policy-aware retrieval plans.

**Outputs**
- `query_plan`
- `parameter_request_plan`

### Stage 5: Retrieval + Extraction
Run retrieval, scrape/PDF extraction, normalize, and structure candidate facts.

**Outputs**
- `raw_search_sessions`
- `normalized_sources`
- `candidate_evidence_items`

### Stage 6: Evidence Validation
Score quality, dedupe, resolve conflicts, and validate scope alignment.

**Outputs**
- `validated_evidence_bundle`
- `rejected_evidence_bundle`
- `evidence_conflict_log`

### Stage 7: Market + Competitor Synthesis
Use only validated evidence to produce structured market and competitor artifacts.

**Outputs**
- `market_model`
- `competitor_set`
- `positioning_analysis`
- `market_synthesis`

### Stage 8: Assumption Registry Build
Promote evidence-backed facts into valuation-grade assumptions.

**Outputs**
- `assumption_registry`

### Stage 9: Deterministic Valuation
Run DCF and multiples using fixed policy rules and assumption intervals.

**Outputs**
- `valuation_output`
- `scenario_outputs`
- `model_check_results`

### Stage 10: Final Report Assembly
Generate a narrative report with citations, uncertainty, and scenario framing.

**Outputs**
- `report_sections`
- `report_summary`
- `citations_index`
- `run_confidence_summary`

## Hard design rules

### Rule 1: No freeform valuation assumptions
All assumptions must exist as objects inside `assumption_registry`.

### Rule 2: No raw retrieval snippets downstream
Only validated evidence objects may flow into market, competitor, and valuation stages.

### Rule 3: Valuation is deterministic once assumptions are locked
LLMs may summarize or justify. They must not alter valuation math or policy.

### Rule 4: Every accepted fact keeps provenance
Every accepted claim or assumption must reference source URL(s), extraction excerpt(s), and timestamps.

### Rule 5: Uncertainty is explicit
The system must prefer `low/base/high` intervals or `insufficient_evidence` over artificial precision.

## Canonical artifact relationships

```text
company_profile + historical_financials
  -> report_spec

report_spec + policy_versions
  -> query_plan

query_plan + retrieved_sources
  -> candidate_evidence_items

candidate_evidence_items + scoring + conflict_resolution
  -> validated_evidence_bundle

validated_evidence_bundle + company_profile + market_model
  -> assumption_registry

assumption_registry + valuation_policy
  -> valuation_output
```

## Minimal architecture boundaries

### LLM-led services
- company understanding
- report spec drafting
- query suggestion
- evidence extraction
- narrative synthesis

### Deterministic services
- validators
- source scoring rules
- policy application
- interval construction rules
- consistency checks
- valuation math
- rerun eligibility logic

## Deployment posture

This architecture should work in:
- local Mac mini development
- Dockerized local orchestration
- future cloud deployment

No component should assume `localhost` semantics outside environment configuration.
