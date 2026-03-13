# 07. Deterministic Valuation Engine

## Purpose

Valuation must become a deterministic service fed by the assumption registry and policy objects.

The valuation engine should:
- calculate
- validate
- scenario-test
- explain inputs and outputs

It should not:
- invent assumptions
- reinterpret policy on the fly
- consume raw web text
- depend on hidden prompt behavior

## Supported valuation modes for v1

### 1. DCF (FCFF-first)
Recommended default when assumption coverage is sufficient.

### 2. Trading comps
Use when peer set quality is acceptable.

### 3. Optional blended view
Weighted narrative output combining DCF and comps.

## Inputs

```yaml
valuation_request:
  report_id: "..."
  company_id: "..."
  policy_versions:
    valuation_policy_version: "dcf_v1"
    comp_policy_version: "multiples_v1"
  assumptions:
    market_growth: {}
    operating_assumptions: {}
    valuation_assumptions: {}
  historical_financials: {}
  peer_set: {}
```

## Outputs

```yaml
valuation_output:
  report_id: "..."
  status: "complete"
  models_run:
    - dcf_fcff
    - trading_comps
  dcf_result:
    enterprise_value_base: 1000
    equity_value_base: 850
    per_share_value_base: null
  scenario_outputs:
    bear: {}
    base: {}
    bull: {}
  model_checks:
    passed: true
    checks:
      - code: "fcff_wacc_consistency"
        passed: true
      - code: "terminal_growth_ceiling"
        passed: true
  sensitivity:
    wacc_plus_100bps: {}
    terminal_growth_minus_50bps: {}
```

## Required model checks

### Core consistency
- FCFF with WACC
- FCFE with Cost of Equity
- no negative/invalid denominator conditions
- terminal growth ceiling respected
- scenario ordering sanity
- multiple definition uniformity

### Optional sanity checks
- reinvestment/growth coherence
- implied margin path reasonableness
- capex/NWC intensity stability flags

## Scenario model

The engine should consume interval assumptions and produce:
- bear
- base
- bull

It should also allow limited sensitivity grids for:
- WACC
- terminal growth
- exit multiple

## Explainability requirements

The engine must emit:
- which assumptions were used
- which scenario values were used
- which checks passed/failed
- where results are low-confidence

## Interface boundary with LLM layer

The LLM may generate:
- a textual explanation of the valuation
- interpretation of scenario results
- caveats and risks

The LLM may not:
- override scenario values
- recalculate policy rules
- mutate the accepted assumption registry

## Suggested implementation modules

```text
backend/services/valuation/valuation_engine.py
backend/services/valuation/dcf_engine.py
backend/services/valuation/comps_engine.py
backend/services/valuation/model_checks.py
backend/services/valuation/scenario_builder.py
```

## v1 scope limits

Keep v1 tight:
- no full Monte Carlo
- no bespoke capital structure optimizer
- no analyst-side spreadsheet editor
- no hidden manual overrides

Build the deterministic spine first.
