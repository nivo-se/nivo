# Deep Research V2 — Phase 0 Baseline Inventory

**Status:** Phase 0 complete  
**Date:** 2026-03-13  
**Purpose:** Document current baseline before V2 refactor per [docs/deep_research/tightning/09-implementation-roadmap.md](tightning/09-implementation-roadmap.md).

---

## 1. Current orchestrator (LangGraph)

**Location:** `backend/orchestrator/langgraph_orchestrator.py`

**Pipeline nodes (V1 order):**

| Order | Node | Purpose |
|-------|------|---------|
| 1 | identity | Company resolution (orgnr, website, geography) |
| 2 | company_understanding | Canonical company profile |
| 3 | web_retrieval | Tavily search + extraction |
| 4 | company_profile | Structured profile enrichment |
| 5 | market_analysis | Market model |
| 6 | competitor_discovery | Competitor set discovery |
| 7 | product_research | Product/segment research |
| 8 | transaction_research | Transaction multiples |
| 9 | strategy | Strategy analysis |
| 10 | value_creation | Value creation initiatives |
| 11 | financial_model | Projections |
| 12 | valuation | Valuation outputs |
| 13 | verification | Claim verification |
| 14 | report_generation | Final report |

**Run lifecycle:** RQ worker enqueues jobs; orchestrator executes synchronously per run.

---

## 2. Current persistence (Deep Research schema)

**Schema:** `deep_research`

**Tables:**

- `companies` — Target companies (orgnr, name, website, industry)
- `analysis_runs` — Run metadata (company_id, status, query, extra JSONB)
- `run_node_states` — Per-node checkpoints (run_id, node_name, input_json, output_json, status)
- `sources` — Retrieved URLs and content
- `claims`, `claim_sources` — Verification linkage
- `reports`, `report_versions` — Generated reports
- Additional tables per `database/migrations/024_deep_research_persistence.sql`

**Models:** `backend/db/models/deep_research.py`

---

## 3. Current API surface

**Prefix:** `/api/deep-research/`

**Routes:**

- `GET /health` — Readiness check
- `POST /analysis/start` — Start run (enqueue)
- `GET /analysis/runs` — List runs
- `GET /analysis/runs/{run_id}` — Run detail
- `GET /analysis/runs/{run_id}/status` — Run status
- Companies, competitors, verification, sources, reports, recompute — various CRUD

**Entry:** `backend/api/deep_research.py` + `backend/api/deep_research_routes/`

---

## 4. Current retrieval

**Service:** `backend/services/web_intel/web_retrieval_service.py`

- Uses Tavily for search
- Bounded retrieval loop (per BOUNDED_RETRIEVAL_LOOP_SPEC)
- Query planner in `backend/retrieval/query_planner.py`
- Evidence extraction, scoring, verification in `web_intel/`

---

## 5. Current validators

**Location:** `backend/orchestrator/stage_validators.py`

- `STAGE_VALIDATORS` map node_name → validation fn
- `STRICT_STAGE_GATING` for fail-fast
- `MAX_STAGE_RETRIES` per node

---

## 6. V2 alignment (from tightening pack)

**Target stage order (06-orchestration-and-stage-gates):**

1. company_resolution
2. financial_grounding
3. company_understanding
4. **report_spec** (new)
5. **query_compilation** (new)
6. **web_intelligence** (rename web_retrieval)
7. **evidence_validation** (new; formalize verification)
8. competitor_intelligence (merge competitor_discovery + competitor_profiles)
9. market_synthesis
10. **assumption_registry** (new)
11. valuation
12. **report_assembly** (rename report_generation)

**Canonical spine:**

`report_spec -> validated_evidence_bundle -> assumption_registry -> deterministic_valuation -> final_report`

---

## 7. Known blockers for V2 (Phase 0)

| ID | Blocker | Owner | Notes |
|----|---------|-------|-------|
| B1 | Dual orchestration paths (`analysis/`, `agentic_pipeline/` vs `orchestrator/`) | Backend | Single path per Q2 in open-questions |
| B2 | No report_spec schema | Phase 1 | First ticket |
| B3 | No policy config loading | Phase 1 | Policy versions for run context |
| B4 | Retrieval not metric-driven | Phase 2 | Query compiler needed |
| B5 | No validated_evidence_bundle persistence | Phase 3 | Evidence pipeline |
| B6 | No assumption_registry | Phase 4 | Valuation readiness gate |
| B7 | Valuation uses LLM path | Phase 5 | Deterministic DCF/comps |
| B8 | Run workspace UX minimal | Phase 6 | Stage progression, blockers |

---

## 8. Module map reference

See [module-dependency-map.md](module-dependency-map.md) for allowed dependencies and migration strategy.

---

## 9. Open questions reference

See [open-questions.md](open-questions.md) for architectural decisions and inconsistencies.
