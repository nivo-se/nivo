# Deep Research Data Chain Diagnosis

## Purpose

This document traces the full data flow of the Deep Research pipeline, identifies the root cause of missing financial data, catalogues silent failure modes, and defines the pipeline invariants that must always hold.

---

## 1. Explicit Stage Contracts

### Stage 1 — Identity Resolution (`resolve_company`)

```
INPUT:  company_name | orgnr | company_id
OUTPUT: orgnr, canonical_name, homepage, industry
SOURCE: public.companies (primary), deep_research.companies (secondary)
```

The company must be resolved against the main application database (`public.companies`) before any deep-research-specific record is created or reused. The real `orgnr` is the key that unlocks all downstream financial data.

### Stage 2 — Company Profile (`company_profile` node)

```
INPUT:  company_id, orgnr, sources, chunks
OUTPUT: summary, business_model, products_services, geographies, customer_segments
SOURCE: retrieval sources + chunks (web research)
```

### Stage 3 — Market Analysis (`market_analysis` node)

```
INPUT:  company_id, orgnr, sources, chunks
OUTPUT: market_size, growth_rate, trends, risks, opportunities
SOURCE: retrieval sources + chunks (web research)
```

### Stage 4 — Competitor Discovery (`competitor_discovery` node)

```
INPUT:  company_id, sources, chunks
OUTPUT: competitors[], profiles[] (strengths, weaknesses, differentiation)
SOURCE: retrieval sources + semantic similarity
```

### Stage 5 — Strategy Analysis (`strategy` node)

```
INPUT:  company_id, sources, chunks, competitor_discovery output
OUTPUT: investment_thesis, acquisition_rationale, key_risks, diligence_focus
SOURCE: retrieval sources + competitor context
```

### Stage 6 — Value Creation (`value_creation` node)

```
INPUT:  company_id, sources, chunks, strategy output
OUTPUT: initiatives[], timeline, kpis
SOURCE: retrieval sources + strategy context
```

### Stage 7 — Financial Model (`financial_model` node)

```
INPUT:  company_id, sources, strategy output, value_creation output
OUTPUT: assumption_set, forecast (3 scenarios × 3 years), sensitivity
SOURCE: AssumptionsEngine (hash-seed or real historicals) + ProjectionEngine
```

### Stage 8 — Valuation (`valuation` node)

```
INPUT:  company_id, sources, financial_model output
OUTPUT: enterprise_value, equity_value, valuation_range
SOURCE: ValuationEngine (deterministic DCF from projections)
```

### Stage 9 — Verification (`verification` node)

```
INPUT:  run_id, company_id, all persisted claims
OUTPUT: verification status per claim, stats (supported/unsupported/uncertain)
SOURCE: VerificationPipeline (confidence thresholds + evidence checks)
```

### Stage 10 — Report Generation (`report_generation` node)

```
INPUT:  run_id, company_id (triggers full assembly)
OUTPUT: report sections (markdown), completeness report, debug artifact
SOURCE: AnalysisInputAssembler (reads all persisted entities + main-app financials)
```

### Historical Financial Load (within Report Generation)

```
INPUT:  orgnr (real, from deep_research.companies)
OUTPUT: revenue_history, ebitda_history, profit_history, financial_years_count
SOURCE: public.financials (WHERE orgnr = real_orgnr)
LIMIT:  4 years, year >= 2018, currency SEK
```

### Assumptions Build (within Report Generation)

```
INPUT:  derived_financial_history, market_analysis
OUTPUT: starting_revenue, growth_start, margin_start, projection_years (3)
SOURCE: real historicals (preferred) | synthetic seed (fallback)
```

---

## 2. Root Cause Analysis

### The problem

`RunStateRepository.resolve_company()` in `backend/orchestrator/persistence.py` only queries `deep_research.companies`. It never looks up the real `orgnr` from the main `public.companies` table.

When a request arrives with `company_name` and no `orgnr`:

1. `resolve_company()` searches `deep_research.companies` by name
2. If not found, it creates a new row with `orgnr = tmp-{uuid4().hex[:20]}`
3. The identity agent passes through this synthetic orgnr unchanged
4. The assembler reads `ai.orgnr = "tmp-..."` during report generation
5. `_load_historical_financials()` queries `financials WHERE orgnr = 'tmp-...'`
6. Zero rows returned — the real financial data sits under the real orgnr
7. All derived metrics, model assumptions, projections, and report sections are empty or synthetic

### Chain of consequences

```
tmp-orgnr created
  → historical financials empty (0 years)
    → derived history empty (no CAGR, no margins)
      → model assumptions fall back to synthetic hash-seed
        → projections based on synthetic data
          → valuation based on synthetic projections
            → report has empty financial tables and thin narrative
```

### The fix

Resolve from `public.companies` first. Since all Deep Research targets are companies already in our database, the real `orgnr` always exists there.

---

## 3. Identified Silent Failure Modes

### FM1 — Synthetic orgnr replaces real identity

`resolve_company()` creates `tmp-` orgnrs when the company isn't found in `deep_research.companies` by name. The identity agent then propagates this synthetic orgnr without attempting to resolve it from the main DB.

### FM2 — Historical financials silently empty

`_load_historical_financials()` queries with the synthetic orgnr and gets zero rows. It returns silently — no error, no warning, no flag. The assembler continues with an empty `historical_financials` list.

### FM3 — AssumptionsEngine uses synthetic seed values

The `AssumptionsEngine.build()` method generates all assumptions via hash-based synthetic seeds (`_stable_range()`), producing deterministic but fictional values (revenue 350-2200 MSEK, growth 9-22%, etc.). It does not check whether real historical data is available.

### FM4 — Report generated without data quality warnings

The report composer renders sections even when financial tables are empty. There is no visible warning to the analyst that the report was generated with incomplete data. The completeness validator produces a report but it is only stored in the debug artifact, not surfaced in the report itself.

---

## 4. Pipeline Invariants

These must always hold true:

1. **orgnr must be real** — never `tmp-`. A `tmp-` orgnr in production is a bug.
2. **Companies must exist in `public.companies`** — Deep Research only targets companies already in our database.
3. **>= 3 years of financial history expected** — the `financials` table should have data for these companies.
4. **Projections must start from real historicals** — not synthetic hash-seed values.
5. **Assumptions must be sourced from real data when available** — the `assumptions_source` must be `"real_historicals"` whenever historicals are loaded.
6. **A stage may not emit output to the next stage unless validation passes** — the Generate -> Validate -> Refine -> Approve pattern.

---

## 5. Projection Horizon

The projection horizon is intentionally set to 3 years (not 7 as in the original schema spec `13_database-schema-spec.md`). SME forecasting reliability drops significantly beyond 3 years. The system uses:

- 4 historical years where available
- 3 projection years by default

This is already correctly implemented in:
- `AssumptionsEngine.horizon_years = 3`
- `ProjectionEngine.build()` defaults to 3
- `_build_model_assumptions()` sets `projection_years = 3`

---

## 6. Agent Architecture Note

Deep Research is deterministic. All agents (identity, company_profile, market_analysis, competitor_discovery, strategy, value_creation, financial_modeling, valuation) are heuristic/rule-based. They use text parsing, semantic similarity, and deterministic calculations. LLM involvement is optional enrichment only. There are no OpenAI payloads to audit in the core pipeline.
