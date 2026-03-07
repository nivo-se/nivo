# Nivo Deep Research - Engineering Execution Plan

## 0) Context and planning assumptions

This repository currently does **not** contain the referenced source-of-truth folder `docs/deep_research/` with architecture/schema/contracts documents.  
This execution plan is therefore based on:

- existing docs in `docs/` (notably `API_CONTRACT.md`, `AI_ANALYSIS_WORKFLOW.md`, `PLAN_BACKEND_WORKFLOW.md`, `SCRAPER_VS_BACKEND.md`, `SQLITE_TO_POSTGRES_COMPARISON.md`)
- existing backend implementation in:
  - `backend/api/*`
  - `backend/analysis/*`
  - `backend/agentic_pipeline/*`
  - `backend/services/*`
  - `database/migrations/*`

The plan below is ready for execution, but some items are marked **decision required** and listed in `open-questions.md`.

---

## 1) Current repository structure (implementation-relevant)

Top-level directories relevant to Deep Research:

- `backend/` (FastAPI, workflow, AI analysis, services)
- `database/` (schema + migrations)
- `docs/` (API and workflow docs)
- `frontend/` (client consuming analysis endpoints)
- `scripts/` (bootstrap/migration/ops scripts)

Current backend substructure:

- `backend/api` (HTTP contracts, request shaping, persistence coordination)
- `backend/analysis` (3-stage workflow orchestration and stage implementations)
- `backend/agentic_pipeline` (targeting, screening/deep AI analysis, web enrichment)
- `backend/services` (DB abstraction + report/summary service helpers)

Gaps vs target module set:

- present: `backend/api`, `backend/services`
- missing as explicit modules: `backend/agents`, `backend/orchestrator`, `backend/retrieval`, `backend/verification`, `backend/report_engine`, `backend/models`, `backend/db`

---

## 2) Recommended backend module structure

Target modules and responsibilities:

### `backend/api`
- FastAPI routers only
- request/response validation
- auth/session context extraction
- delegates work to orchestrator/services (no heavy business logic)

### `backend/orchestrator`
- run lifecycle management (create/update/complete/fail)
- stage sequencing and retries
- idempotency and cancellation handling
- fan-out/fan-in coordination across retrieval/agents/verification/report modules

### `backend/agents`
- LLM interaction layer (screening agent, deep analysis agent, prompt templates)
- structured output schemas
- model routing and cost/latency controls

### `backend/retrieval`
- company context assembly from DB + direct URL fetch (when URL already known)
- web research enrichment and normalization
- evidence packaging for agents

### `backend/verification`
- output quality checks and policy checks
- schema conformance, evidence coverage, missing-data detection
- review status transitions (`pending/approved/rejected`) and confidence gating

### `backend/report_engine`
- report composition (screening summary, deep memo, AI report variants)
- canonical report serialization and versioning
- mapping raw agent outputs to UI/API contract DTOs

### `backend/services`
- reusable domain services (cache, formatting, adapters, shared helpers)
- no orchestration ownership

### `backend/models`
- typed domain entities and API DTOs
- stage payload models and persistence models

### `backend/db`
- repository layer and SQL access abstraction
- migration-safe query interfaces
- transaction boundaries and run-scoped writes

---

## 3) Execution phases and implementation order

## Phase 1 - Architecture baseline and boundaries (Week 1)

**Goal:** freeze module boundaries and prevent further cross-module drift.

Deliverables:

1. module ADRs for each target module (`api`, `orchestrator`, `agents`, `retrieval`, `verification`, `report_engine`, `services`, `models`, `db`)
2. dependency rules (allowed imports only)
3. run state model standardization (`running`, `stage_1_complete`, `stage_2_complete`, `complete`, `failed`, `cancelled`)

Exit criteria:

- all new code follows target module boundaries
- import graph check in CI (static check)

---

## Phase 2 - Database and model foundation (Week 1-2)

**Goal:** stabilize data contracts before deeper refactor.

Deliverables:

1. canonical schema decision for:
   - `acquisition_runs`
   - `company_research`
   - `company_analysis`
   - `saved_lists` + `saved_list_items` (including `scope=public` and `stage`)
2. `backend/models` introduction:
   - run DTOs
   - stage payload DTOs
   - report DTOs
3. `backend/db` layer introduction:
   - repositories for runs, research, analysis, lists
   - typed persistence methods replacing inline SQL in API modules

Exit criteria:

- API and workflow modules no longer issue ad hoc SQL directly
- schema/docs mismatch list reduced to tracked, explicit deltas

---

## Phase 3 - Retrieval and agent modules (Week 2-3)

**Goal:** isolate context gathering and LLM execution paths.

Deliverables:

1. move stage 2 web research logic into `backend/retrieval`
2. move screening/deep agent logic into `backend/agents`
3. normalize input context contracts:
   - financials
   - research evidence
   - enrichment artifacts
4. add retrieval observability:
   - source provenance
   - fetch success/failure metrics
   - extraction confidence

Exit criteria:

- orchestrator consumes retrieval/agents through explicit interfaces
- no direct OpenAI calls in API routers

---

## Phase 4 - Orchestrator unification (Week 3)

**Goal:** unify duplicated orchestration paths currently split between `backend/analysis` and `backend/agentic_pipeline`.

Deliverables:

1. new `backend/orchestrator` run manager
2. stage pipeline definition:
   - Stage 1: financial selection / candidate set
   - Stage 2: retrieval enrichment
   - Stage 3: agent analysis (screening/deep modes)
3. idempotent rerun behavior and duplicate prevention
4. cancellation and retry semantics

Exit criteria:

- single orchestration entrypoint per analysis mode
- historical run retrieval remains backward compatible for frontend

---

## Phase 5 - Verification pipeline and moderation (Week 4)

**Goal:** enforce output quality and trust controls before report publication.

Deliverables:

1. `backend/verification` module with checks:
   - schema validity
   - required sections present
   - confidence + missing-data requirements
   - recommendation rationale completeness
2. verification status persistence (run-level and company-level)
3. moderation workflow integration (`approved/rejected`) as post-verification gate

Exit criteria:

- no report marked final without verification pass (or explicit override reason)

---

## Phase 6 - Report engine and API contract hardening (Week 4-5)

**Goal:** make report generation deterministic and contract-safe.

Deliverables:

1. `backend/report_engine` for canonical report assembly
2. response contract unification across:
   - `/api/analysis/*`
   - `/api/ai-analysis`
   - `/api/companies/{orgnr}/ai-report`
3. versioned report payload schema
4. contract tests for frontend-critical response fields

Exit criteria:

- one canonical report model mapped to endpoint-specific projections
- API contract docs updated and consistent

---

## Phase 7 - Observability, reliability, and rollout (Week 5)

**Goal:** production readiness.

Deliverables:

1. tracing and metrics:
   - run duration per stage
   - retrieval success rates
   - LLM token/cost per run
   - verification pass/fail rates
2. load and failure-mode tests
3. staged rollout with feature flags by endpoint

Exit criteria:

- SLOs defined and monitored
- rollback strategy documented per feature flag

---

## 4) Recommended implementation sequence (compressed checklist)

1. Align docs/contracts and close high-priority open questions.
2. Build `backend/models` + `backend/db` first.
3. Extract `retrieval` and `agents` from existing mixed modules.
4. Introduce `orchestrator` and switch API routers to it.
5. Add `verification` gates.
6. Add `report_engine` and finalize contracts.
7. Harden with metrics/tests and rollout controls.

---

## 5) Branch strategy

Recommended branch sequence (one logical change per branch):

1. `feature/deep-research-architecture-baseline`
2. `feature/deep-research-db-model-layer`
3. `feature/deep-research-retrieval-module`
4. `feature/deep-research-agents-module`
5. `feature/deep-research-orchestrator`
6. `feature/deep-research-verification-pipeline`
7. `feature/deep-research-report-engine`
8. `feature/deep-research-api-contract-hardening`
9. `feature/deep-research-observability-rollout`

If you prefer shorter names, this equivalent strategy is also valid:

- `feature/db-schema`
- `feature/api-contracts`
- `feature/retrieval`
- `feature/orchestrator`
- `feature/verification`
- `feature/report-engine`

Branch policy:

- merge to main only after contract + migration + regression checks pass
- avoid parallel schema-changing branches unless one is designated migration trunk
- protect compatibility endpoints until frontend migration is complete

---

## 6) Engineering governance and quality gates

Required gates per PR:

1. migration safety check (up/down or idempotence)
2. API contract snapshot test
3. run lifecycle test (create -> stage transitions -> completion/failure)
4. verification pipeline test coverage
5. basic load test for batch analysis endpoints

Operational readiness gates:

- dashboards for run throughput/failure
- alerts on verification failure spikes
- replay tooling for failed runs

---

## 7) Risks and mitigations

1. **Contract drift between docs and implementation**
   - mitigation: contract snapshots + doc updates in same PR

2. **Dual orchestration paths create inconsistent behavior**
   - mitigation: orchestrator unification before feature expansion

3. **Schema drift across migrations and runtime assumptions**
   - mitigation: central `backend/db` repositories + migration audit

4. **LLM output instability**
   - mitigation: strict JSON schemas + verification gates + retries

5. **Front-end breakage during transition**
   - mitigation: compatibility response adapters and phased endpoint cutover

---

## 8) Definition of done for platform execution

Deep Research execution is complete when:

- target module layout exists and is used by production paths
- run orchestration is unified and idempotent
- retrieval, agent, verification, and report modules are isolated and test-covered
- API contracts are versioned and consistent with implementation
- migration/schema and docs are synchronized
- observability and rollout safeguards are in place

