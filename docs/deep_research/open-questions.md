# Nivo Deep Research - Open Questions and Architectural Inconsistencies

## 1) Critical blockers (resolve first)

## Q1. Missing source-of-truth documentation folder

**Observation:** Requested canonical docs folder `docs/deep_research/` was absent before this planning task.  
**Impact:** Architecture, schema, and contract authority is ambiguous; implementation can drift.  
**Decision needed:** Confirm the canonical Deep Research spec location and ownership.  
**Recommended owner:** Tech lead / system architect.  
**Priority:** P0.

---

## Q2. Dual orchestration implementations

**Observation:** There are two major analysis paths:

- `backend/analysis/*` (workflow + stage1/2/3)
- `backend/agentic_pipeline/*` (screening/deep + enrichment + orchestrator utilities)

**Impact:** Divergent run semantics, duplicated logic, potential inconsistent persistence/contracts.  
**Decision needed:** Choose single orchestrator path and deprecate the other.  
**Recommended owner:** Backend lead.  
**Priority:** P0.

---

## Q3. Canonical API surface for analysis

**Observation:** Both `/api/analysis/*` and `/api/ai-analysis` expose overlapping run/analysis behavior with different payload shapes.  
**Impact:** Frontend integration complexity and backward-compatibility risk.  
**Decision needed:** Define primary API family and compatibility window for secondary family.  
**Recommended owner:** API lead + frontend lead.  
**Priority:** P0.

---

## 2) High-priority inconsistencies (docs vs code/schema)

## I1. `saved_company_lists` vs `saved_lists` terminology drift

- `docs/API_CONTRACT.md` still references `saved_company_lists` for enrichment list resolution.
- Current backend and migrations use `saved_lists` + `saved_list_items`.

**Risk:** wrong table assumptions in new development and ops scripts.  
**Action:** update contract docs and enforce one naming convention.

---

## I2. List scope state appears inconsistent across docs

- `docs/PLAN_BACKEND_WORKFLOW.md` describes public scope as a change to be made.
- Migration `database/migrations/023_saved_lists_public_scope.sql` already exists.
- `backend/api/lists.py` supports `scope in ('private','team','public')`.

**Risk:** teams may re-implement already-shipped features or skip migration rollout verification.  
**Action:** confirm environment migration state and mark doc as implemented/pending-by-env.

---

## I3. Status/readiness checks omit analysis tables

- `backend/api/status.py` checks `companies`, `financials`, `company_kpis`, enrichment tables.
- Analysis tables (`acquisition_runs`, `company_research`, `company_analysis`) are checked elsewhere (`/api/analysis/status`) but not in primary status contract.

**Risk:** false healthy signal for Deep Research readiness.  
**Action:** extend canonical status contract for Deep Research modules.

---

## I4. Database README appears stale

- `database/README.md` references files (e.g., valuation schema docs) that do not align with current file inventory.

**Risk:** onboarding confusion and wrong setup paths.  
**Action:** refresh DB README to current schema/migration reality.

---

## I5. Legacy SQLite references in active planning docs

- Several docs still compare or reference SQLite-era assumptions, while runtime is Postgres-only (`backend/services/db_factory.py` rejects local SQLite path).

**Risk:** implementation/ops decisions based on deprecated environment model.  
**Action:** explicitly mark SQLite docs as historical and separate from active architecture.

---

## 3) Architecture decisions needed by module

## A) `backend/db`

1. Should all run-state writes be centralized in repository methods (no SQL in API/orchestrator)?
2. Should we formalize optimistic locking/version column on `acquisition_runs`?
3. Should `company_research` remain `orgnr`-primary-key or become `(orgnr, run_id)` to preserve run history?

Priority: P0/P1.

## B) `backend/models`

1. What is canonical DTO schema for screening vs deep responses?
2. Do we version API DTOs now (`v1`, `v2`) or keep implicit versioning?

Priority: P1.

## C) `backend/retrieval`

1. Confirm policy boundary: direct URL fetch only when URL already exists (per `SCRAPER_VS_BACKEND.md`).
2. Define max fetch depth/timeout and acceptable content quality thresholds.
3. Decide whether placeholder/simulated news logic can remain in production path.

Priority: P0/P1.

## D) `backend/agents`

1. One model strategy or mode-specific models (screening vs deep)?
2. How to unify prompt templates across `/api/analysis/templates` and agentic prompts?
3. Required audit fields (prompt, output, token usage, cost, latency) for compliance/ops?

Priority: P1.

## E) `backend/verification`

1. Mandatory verification checks before persistence vs before publish?
2. Auto-reject thresholds (e.g., missing required sections, low confidence)?
3. How does manual moderation (`analysis_result_reviews`) interact with auto verification status?

Priority: P0.

## F) `backend/report_engine`

1. One canonical report object with endpoint projections, or endpoint-specific report schemas?
2. Should report generation be deterministic from stored artifacts (no model call in read path)?
3. How to reconcile AI report (`/api/ai-reports`) with deep analysis memo schema?

Priority: P1.

## G) `backend/orchestrator`

1. Single run type model or separate run types for screening/deep/acquisition pipeline?
2. Idempotency key strategy for duplicate-request suppression?
3. Retry semantics per stage (especially retrieval and agent calls)?

Priority: P0.

---

## 4) API contract questions

1. Which endpoint set is canonical for run history retrieval: `/api/analysis/runs` or `/api/ai-analysis?history=1`?
2. Should `analysisType` remain free string (`screening|deep`) or become strict enum in shared DTO?
3. Should all endpoints expose `run_id_by_kind`/`source_flags` for traceability?
4. Do we guarantee recommendation labels (`buy/pass/watch`) across all analysis endpoints?

Priority: P0/P1.

---

## 5) Verification and testing gaps

1. No explicit contract test matrix across all analysis endpoints.
2. No explicit integration test asserting stage transition correctness for failures/cancellations.
3. No formal verification quality score persisted with analysis results.

Recommended next step:

- create a test matrix doc and map each endpoint to contract + workflow + failure-case tests.

---

## 6) Suggested decision cadence

To unblock execution quickly:

1. **Architecture alignment session (90 min)** - settle Q1/Q2/Q3 + endpoint canonical path.
2. **Schema/API sync session (60 min)** - resolve naming/table/status inconsistencies.
3. **Implementation kickoff** - start Phase 1 and Phase 2 branches immediately after decisions.

---

## 7) Tracking format recommendation

Use this template for each unresolved item:

- **ID**
- **Decision owner**
- **Decision deadline**
- **Options considered**
- **Chosen option**
- **Migration impact**
- **Contract impact**

This avoids silent drift while implementation proceeds in parallel branches.

