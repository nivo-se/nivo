---
name: Sequential Gating and Payload Audit
overview: Audit and harden the Deep Research pipeline for strict sequential execution, full payload completeness, assumptions grounding in real historicals, company-understanding-before-market-retrieval gating, proprietary input support, and improved debug visibility. Deliver three audit docs and targeted code fixes.
todos: []
isProject: false
---

# Sequential Gating and Payload Audit Plan

## Current State Summary

**Pipeline flow:** Linear 10-node chain (identity → company_profile → market_analysis → competitor_discovery → strategy → value_creation → financial_model → valuation → verification → report_generation). No conditional edges.

**Retrieval:** Separate API `POST /sources/search-company`; not invoked by the pipeline. QueryPlanner uses only `company_name`, `orgnr`, `website` — generic queries ("official website", "company profile Sweden", "latest news"). No market-specific retrieval exists.

**Assumptions:** `AssumptionsEngine` in the `financial_model` node always uses `synthetic_seed` because `_extract_real_historicals()` looks for chunks with `metadata.type == "historical_financials"` — nothing in the pipeline creates such chunks. Real historicals are loaded only in the assembler during report generation, after projections are already persisted from synthetic assumptions.

**LLM usage:** Core pipeline agents are heuristic/rule-based (no OpenAI in orchestrator). Embeddings use OpenAI. `agentic_pipeline` (ai_reports, ai_analysis) is a separate flow, not Deep Research.

**Proprietary input:** No contract or support for user-provided company materials.

---

## Phase 1: Audit Documents (Read-Only)

### 1.1 Create `docs/deep_research/sequential-execution-audit.md`

**Content to include:**

- Actual stage dependency graph (Mermaid diagram)
- Required inputs per stage (from [langgraph_orchestrator.py](backend/orchestrator/langgraph_orchestrator.py) and [persistence.py](backend/orchestrator/persistence.py) `build_agent_context`)
- Validation gates per stage (from [stage_validators.py](backend/orchestrator/stage_validators.py))
- Where weak output handoff occurs:
  - `validate_company_profile` returns `warn` for missing summary/business_model — pipeline continues
  - `validate_market_analysis` returns `warn` for missing market_label — pipeline continues
  - `STRICT_STAGE_GATING` is off by default; degraded stages do not block
- Retrieval vs pipeline: retrieval is pre-pipeline API call; no in-pipeline market retrieval
- Recommended tightening: gate market_analysis on company_profile quality; add optional second retrieval phase after company_profile

### 1.2 Create `docs/deep_research/openai-payload-audit.md`

**Content to include:**

- Clarification: Core Deep Research pipeline has no LLM-facing stages (per [data-chain-diagnosis.md](docs/deep_research/data-chain-diagnosis.md) section 6)
- Embedding usage: [embedding.py](backend/retrieval/embedding.py) — `embed_texts()` for chunk embeddings; inputs are chunk text strings
- If future LLM stages are added: required payload fields, expected missing inputs, recommended structure
- Document the heuristic agent "payloads" (context passed to each agent) for completeness

### 1.3 Create `docs/deep_research/proprietary-input-integration-spec.md`

**Content to include:**

- Contract for injected company-specific data: investor presentations, internal notes, customer/channel notes, management-provided market pointers
- Source type taxonomy: `company_website`, `web_search`, `proprietary_investor_deck`, `proprietary_internal_notes`, etc.
- How proprietary sources flow into `build_agent_context` and `AnalysisInput`
- API contract: `POST /sources/ingest` extension or new endpoint for proprietary upload
- Schema: `Source.source_type`, `Source.metadata` for `provenance`, `document_kind`

---

## Phase 2: Code Fixes

### 2.1 Company Understanding Before Market Retrieval

**Problem:** Retrieval runs before the pipeline (separate API). There is no market-specific retrieval. The mission requires market retrieval to run only after company understanding.

**Approach:**

- Add a gate in [stage_validators.py](backend/orchestrator/stage_validators.py): `validate_company_profile` must pass (or at least have `business_model`, `products_services`, `geographies`) before `market_analysis` is allowed to proceed with non-degraded status.
- Extend `validate_company_profile` with optional threshold checks: `products_services` non-empty, `geographies` non-empty (configurable via `DEEP_RESEARCH_THRESHOLDS`).
- If `market_analysis` runs when `company_profile` is weak: record `degraded_reason` and ensure it surfaces in the report.
- **Optional future work:** Add a second retrieval phase inside the pipeline after `company_profile` — `QueryPlanner.plan_market_queries(company_profile_output)` that builds market-specific queries using `market_label`, `niche_label`, `products_services`. This would require pipeline changes to invoke retrieval mid-run. Defer to follow-up unless explicitly in scope.

### 2.2 Assumptions Grounded in Real Historicals

**Problem:** `AssumptionsEngine` in the `financial_model` node never receives real historicals. It looks for chunks with `metadata.type == "historical_financials"` but no such chunks exist.

**Approach:**

- **Option A (preferred):** Inject historical financials into the agent context before `financial_model` runs. The assembler already loads financials from `public.financials` by orgnr. We need to pass that data to the `financial_model` node.
- **Implementation:**
  - In [langgraph_orchestrator.py](backend/orchestrator/langgraph_orchestrator.py), before calling `FinancialModelingAgent.run()`, load historical financials via the same logic as `_load_historical_financials` (or a shared helper). Build a synthetic "chunk" or extend `AgentContext` with `historical_financials: list[dict]` and `derived_metrics: dict`.
  - In [assumptions_engine.py](backend/agents/assumptions_engine.py), add a path: if `context.historical_financials` is present (new field), use it to compute `starting_revenue_msek`, `revenue_growth`, `ebitda_margin` and set `assumptions_source = "real_historicals"`.
  - Ensure `build_agent_context` or the financial_model compute fn receives orgnr and can call the main-app financials loader.
- **Option B:** Move assumption building to report generation (assembler) and have the financial_model node only run ProjectionEngine with assembler-provided assumptions. Larger refactor; prefer Option A.

### 2.3 Full Structured Payloads to Agents

**Problem:** `build_agent_context` loads company, sources, chunks. It does not include: historical financials, market data from prior stages, competitor context from prior stages (for strategy/value_creation). Some nodes receive `node_results` from upstream (strategy, value_creation, financial_model) but the initial retrieval and company context may be thin.

**Approach:**

- Ensure `financial_model` receives: (1) historical financials (new), (2) market_analysis output (`node_results["market_analysis"]`), (3) strategy and value_creation as today.
- Add `market_analysis` output to `financial_model` input in [langgraph_orchestrator.py](backend/orchestrator/langgraph_orchestrator.py) — pass `market_data` into `AssumptionsEngine` for `market_growth_base` when available.
- Verify `ProjectionEngine` and report composer use `projection_years = 3` consistently (already set in AssumptionsEngine and schema).

### 2.4 Tighten Sequential Gating

**Approach:**

- Add `validate_strategy` and `validate_value_creation` with minimal checks (non-empty output) so all stages have validators.
- Consider enabling `STRICT_STAGE_GATING` for critical stages (identity, company_profile) in production, or document when to enable it.
- Ensure `stage_evaluations` and `report_degraded_reasons` are persisted and included in the debug artifact.

### 2.5 Proprietary Input Support

**Approach:**

- Extend [analysis_input.py](backend/services/deep_research/analysis_input.py) with optional `injected_sources: list[InjectedSource]` or document that `Source` with `source_type="proprietary_*"` is the mechanism.
- Extend [analysis_input_assembler.py](backend/services/deep_research/analysis_input_assembler.py) to treat `Source.source_type` in `("proprietary_investor_deck", "proprietary_internal_notes", ...)` as additional evidence; ensure they are included in `build_agent_context` and `source_refs`.
- Add API support: `POST /sources/ingest` already exists; document that `source_type` can be `proprietary_investor_deck`, etc. Add validation for allowed types.
- Implement or extend the ingest flow so proprietary docs are stored as Sources and chunked like web sources.

### 2.6 Debug Visibility

**Approach:**

- Extend [debug_dump.py](backend/services/deep_research/debug_dump.py) with:
  - `company_understanding_payload` (summary, business_model, products_services, geographies, customer_segments)
  - `market_search_input_payload` (queries used — from retrieval; if retrieval is pre-pipeline, log the QueryPlanner output when search-company is called)
  - `model_input_payload` (what AssumptionsEngine received: historical_financials present/absent, strategy keys, value_creation keys)
  - `assumptions_source` (already present)
  - `degraded_reasons` (already present)
  - `missing_field_lists` from InputCompletenessValidator (already in completeness_report)
- Ensure the debug artifact is stored with the report version and exposed via API for inspection.

---

## Phase 3: Projection Horizon

- Confirm 3-year projection is used everywhere: [AssumptionsEngine](backend/agents/assumptions_engine.py) `horizon_years=3`, [ProjectionEngine](backend/agents/projection_engine.py), report composer. No expansion to 7 years.

---

## Files to Modify


| File                                                                                                                     | Changes                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [backend/orchestrator/stage_validators.py](backend/orchestrator/stage_validators.py)                                     | Stricter company_profile checks; add strategy/value_creation validators                            |
| [backend/orchestrator/langgraph_orchestrator.py](backend/orchestrator/langgraph_orchestrator.py)                         | Inject historical financials into financial_model context; pass market_analysis to financial_model |
| [backend/agents/assumptions_engine.py](backend/agents/assumptions_engine.py)                                             | Accept `historical_financials` from context; use real data when available                          |
| [backend/agents/context.py](backend/agents/context.py)                                                                   | Add `historical_financials`, `derived_metrics` to AgentContext if needed                           |
| [backend/services/deep_research/analysis_input_assembler.py](backend/services/deep_research/analysis_input_assembler.py) | Support proprietary source types in assembly                                                       |
| [backend/services/deep_research/debug_dump.py](backend/services/deep_research/debug_dump.py)                             | Extend with company_understanding_payload, model_input_payload, etc.                               |
| [backend/services/deep_research/analysis_input.py](backend/services/deep_research/analysis_input.py)                     | Optional: InjectedSource or document proprietary source types                                      |
| [backend/api/deep_research_routes/sources.py](backend/api/deep_research_routes/sources.py)                               | Document/validate proprietary source_type values                                                   |


---

## Files to Create


| File                                                                                                                 | Purpose                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [docs/deep_research/sequential-execution-audit.md](docs/deep_research/sequential-execution-audit.md)                 | Stage dependency graph, validators, weak handoff points, recommendations |
| [docs/deep_research/openai-payload-audit.md](docs/deep_research/openai-payload-audit.md)                             | LLM usage audit (embeddings only in core); agent context payloads        |
| [docs/deep_research/proprietary-input-integration-spec.md](docs/deep_research/proprietary-input-integration-spec.md) | Contract for injected company materials                                  |


---

## Definition of Done Checklist

- Company understanding validated before market_analysis proceeds (or degraded reason recorded)
- AssumptionsEngine uses real historicals when orgnr exists and financials are loaded
- 4 years actuals and market inputs reach model/report payloads
- Weak stage outputs not silently passed (degraded flagged and surfaced)
- Proprietary source types supported in contract and assembly
- Debug artifact includes company_understanding_payload, model_input_payload, assumptions_source, degraded_reasons, missing_field_lists
- Projection horizon remains 3 years
- Three audit docs created

---

## Final Summary Template

At completion, report:

1. **Pipeline sequential and gated:** Yes/No — with caveats
2. **Stages still handing off weak outputs:** List
3. **OpenAI payloads full:** N/A for core (embeddings only); document agent payload completeness
4. **Company understanding before market search:** Yes — gate added or retrieval remains pre-pipeline with no market-specific phase
5. **Proprietary materials:** Contract and assembly support added
6. **Files changed:** List
7. **Remaining weak points:** List

