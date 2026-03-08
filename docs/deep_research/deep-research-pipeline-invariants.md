# Deep Research Pipeline Invariants

These invariants must always hold true in the Deep Research system. Violating any of these indicates a bug.

---

## 1. Identity must resolve from `public.companies`

Deep Research is initiated from our UI for companies that already exist in the main application database. The company's `orgnr` must be resolved from `public.companies` before any pipeline stage runs.

If a company cannot be found in `public.companies`, the pipeline raises `CompanyResolutionError` and does not proceed.

## 2. `orgnr` must be real

A `tmp-` orgnr is a bug, not a graceful fallback. The `resolve_company()` function in `persistence.py` will never create synthetic orgnrs in production. If an existing deep-research company has a `tmp-` orgnr, it will be upgraded to the real one upon re-resolution.

## 3. Financial history must exist

The `financials` table in the main database should contain historical data for all target companies. The assembler loads up to 4 years of financial history (year >= 2018, currency SEK). If `historical_financials` is empty after assembly, the completeness validator flags this as a blocking issue.

Minimum threshold: 3 years of financial data.

## 4. Analysis must be based on real financials

The `AssumptionsEngine` tracks its source via `assumptions_source`:
- `"real_historicals"` — assumptions derived from actual financial data
- `"synthetic_seed"` — fallback hash-based generation

When real historicals are available, the engine must use them. Synthetic-seed assumptions should only occur when financial data is genuinely unavailable (which is a bug for companies in our DB).

## 5. Assumptions must prefer real data over synthetic seeds

The assembler's `_build_model_assumptions()` already prefers real derived financial history when populating `ModelAssumptions`. The `AssumptionsEngine` (which runs during the `financial_model` node) also checks for real historicals in the agent context before falling back to synthetic generation.

## 6. A stage may not emit output unless validation passes

The pipeline implements the Generate -> Validate -> Refine -> Approve pattern:
- Each stage's output is checked by a per-stage validator
- If validation fails, the stage retries (up to 2 retries)
- After all retries, the stage is marked as degraded
- Degraded stages are recorded and surfaced in the report

## 7. Projection horizon is 3 years

The projection horizon is intentionally set to 3 years (not 7 as in the original schema spec). SME forecasting reliability drops significantly beyond 3 years. The system uses:
- 4 historical years where available
- 3 projection years by default

## 8. Reports must surface data quality issues

When the pipeline is degraded or financial data is missing, warning banners must appear in the report. Silent generation of thin reports without quality indicators is a bug.
