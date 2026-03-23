# Screening Orchestrator — Implementation Spec

**Status:** Draft for implementation  
**Audience:** Backend + worker implementers  
**Precedence:** Aligns with `IMPLEMENTATION_INDEX.md`, `AGENTS.md`, and existing Layer 1 screening (`screening_profiles`, `/api/universe/query`).

---

## 1. Purpose

Define a **bounded, Postgres-first orchestration layer** that:

- Runs **large-universe screening** (~13k companies) against **versioned screening profiles** (what Nivo “likes”).
- Uses **deterministic SQL ranking first**, then **cheap LLM + retrieval gates** for business-model relevance and granular fit.
- Produces a **stable shortlist (~100)** and optional **handoff** to the existing **Deep Research** pipeline (per company), without replacing or forking the deep-research architecture.

This is **not** a second “deep research” orchestrator. It is a **screening campaign** orchestrator with explicit stages, persisted state, and traceable outputs.

---

## 2. Scope

### In scope

- New service module: **`backend/services/screening_orchestrator/`** (name may be `universe_screening` if collision risk; pick one and keep it).
- New **DB tables** for campaign runs, stage checkpoints, and per-company outcomes (see §6).
- New **API routes** under e.g. `backend/api/screening_campaigns.py` (prefix `/api/screening/campaigns` or `/api/universe/campaigns` — choose one; document in OpenAPI).
- Integration with:
  - **Screening profiles:** `screening_profiles` / `screening_profile_versions` (`config_json`: variables, weights, archetypes, exclusion_rules).
  - **Universe query logic:** reuse SQL building blocks from `backend/api/universe.py` where possible (extract shared query builder into `backend/services/universe_query.py` in a follow-up if duplication is high).
  - **Web intelligence:** `backend/services/web_intel/` (Tavily; optional OpenAI web search per settings) — **agents must not call Tavily directly** (per existing web_intel patterns).
- **Structured LLM outputs** (JSON schema) for relevance and fit; **no fabricated financials** — financial truth stays in DB / deterministic metrics.

### Out of scope (initial delivery)

- Replacing `LangGraphAgentOrchestrator` or merging screening into deep-research nodes.
- Real-time “always-on” agents for all 13k companies.
- Full claim-level verification for screening (optional later; see §11).
- Frontend UX beyond minimal API contract (can be a separate ticket).

---

## 3. Design principles

1. **PostgreSQL is source of truth** for universe rows, profile config, and campaign state.
2. **Deterministic before stochastic:** SQL profile score + exclusions reduce LLM calls by orders of magnitude.
3. **Explicit stages:** each stage is resumable, logged, and idempotent per `(campaign_id, orgnr)` where applicable.
4. **Preference injection:** every LLM stage receives a **compiled “mandate block”** derived from the active `config_json` + optional campaign overrides (see §5.3).
5. **Evidence for external claims:** snippets/URLs stored for relevance decisions (reuse `web_intelligence` patterns where feasible).

---

## 4. Pipeline stages

### Stage 0 — Campaign bootstrap

**Input:** `profile_id`, optional `profile_version_id`, optional extra filters, target `final_shortlist_size` (default 100), `layer0_limit` (e.g. 2000), `layer1_limit` (e.g. 800), etc.

**Actions:**

1. Load profile config from DB (same semantics as `universe.py` `_get_profile_config`).
2. Persist `screening_campaign` row (`status=running`, config snapshot).
3. Compute deterministic **Layer 0 cohort** using the same universe source subquery + `WHERE` + profile exclusions + optional filters — **do not duplicate business logic by reimplementing filters in Python**. Prefer: SQL query returning `orgnr` + columns needed for downstream prompts.

**Output:** `campaign_id`, cohort size, optional histogram summary (for UI).

### Stage 1 — Deterministic rank & cap (Layer 0)

**Actions:**

1. Sort by `profile_weighted_score` DESC (same formula as `_compute_profile_weighted_score` in `universe.py`).
2. Take top `layer0_limit` (configurable).
3. Persist `screening_campaign_stage` record + `screening_campaign_candidate` rows with `layer=0`, `deterministic_rank`, `profile_weighted_score`, `archetype_code` if present.

**Output:** capped list keyed by `orgnr`.

### Stage 2 — Business relevance gate (Layer 1, LLM + retrieval)

**Goal:** Hard-filter companies whose **operations/mandate** are clearly outside Nivo’s thesis, using **external context** when internal segment data is weak.

**Per company (batched for throughput):**

1. Fetch minimal identity: `name`, `orgnr`, `homepage`, `segment_names`, key financials from universe row.
2. Retrieval: 1–3 **Tavily** queries compiled from company name + orgnr + homepage (via `WebRetrievalService` or a thinner `ScreeningRetrievalFacade` that only returns normalized snippets + URLs).
3. LLM: structured output `RelevanceDecision` (see §7.2).

**Persistence:**

- `screening_campaign_candidate.layer=1`, `relevance_status` ∈ {`pass`, `fail`, `uncertain`}, `relevance_confidence`, `relevance_reason_codes[]`, `evidence_refs[]` (JSON: url, title, snippet).

**Policy:**

- `uncertain` → **default pass** or **default fail** based on `campaign.policy.uncertain_relevance` (`pass_to_layer2` | `reject`). Must be explicit in campaign config.

### Stage 3 — Granular fit score (Layer 2, LLM)

**Input:** Companies that passed Layer 1 (or `uncertain` per policy).

**LLM output:** `FitScorecard` (see §7.3) aligned to explicit rubric dimensions from mandate block.

**Persistence:** `fit_scores` JSON, `fit_total` (0–100), `risk_flag`, optional `next_action` (`deep_research` | `human_review` | `reject`).

### Stage 4 — Final shortlist selection (Layer 3, code-first)

**Actions:**

1. Sort by combined score:  
   `final = w_det * profile_weighted_score + w_fit * fit_total`  
   with weights in campaign config (defaults: `w_det=0.4`, `w_fit=0.6` — tunable).
2. Apply **diversification** rules (optional v1): max N per `segment_tier` / primary segment bucket (define buckets in code from `segment_names` JSON).
3. Take top `final_shortlist_size`.

**Persistence:** mark `is_selected=true` on `screening_campaign_candidate`; store `final_rank`.

### Stage 5 — Handoff (optional)

For each selected company:

- Create **Deep Research** `AnalysisRun` + enqueue worker **or** return IDs for batch trigger via existing API — **do not** invent a parallel report pipeline.

---

## 5. Mandate block (preference injection)

### 5.1 Sources

- Active screening profile `config_json`: variables, weights, archetypes, exclusion_rules (already human-reviewed).
- Optional `campaign.overrides` JSON:
  - `mandate_summary` (short text)
  - `must_have_segments` / `banned_keywords` (list)
  - `policy` (uncertain handling, diversification)

### 5.2 Compiled prompt section (conceptual)

Every LLM call includes:

- **Investment mandate (structured):** bullet list derived from config (e.g. archetype codes + threshold interpretation).
- **Hard exclusions (verbatim):** serialized exclusion rules (for reasoning only — actual enforcement remains SQL).
- **Output schema:** strict JSON schema name + version.

### 5.3 Versioning

Store `mandate_hash` on the campaign row (hash of profile version id + overrides) for auditability.

---

## 6. Database schema (new tables)

**Naming:** prefix `screening_campaign_*` to avoid clashing with `analysis_runs` / deep research.

### 6.1 `screening_campaigns`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `name` | TEXT | Human label |
| `profile_id` | UUID FK → `screening_profiles.id` | |
| `profile_version_id` | UUID FK → `screening_profile_versions.id` nullable | Snapshot if frozen |
| `status` | TEXT | `draft`, `running`, `paused`, `completed`, `failed`, `cancelled` |
| `config_snapshot_json` | JSONB | Copy of profile `config_json` + overrides at start |
| `params_json` | JSONB | layer limits, weights, policies |
| `mandate_hash` | TEXT | |
| `created_by_user_id` | UUID nullable | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |
| `error_message` | TEXT nullable | |

### 6.2 `screening_campaign_stages`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `campaign_id` | UUID FK | |
| `stage` | TEXT | `layer0`, `layer1`, `layer2`, `layer3`, `handoff` |
| `status` | TEXT | `pending`, `running`, `completed`, `failed` |
| `started_at`, `finished_at` | TIMESTAMPTZ | |
| `stats_json` | JSONB | counts, token usage aggregates |
| `error_message` | TEXT nullable | |

### 6.3 `screening_campaign_candidates`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `campaign_id` | UUID FK | |
| `orgnr` | TEXT | Indexed |
| `layer0_rank` | INT nullable | |
| `profile_weighted_score` | NUMERIC nullable | |
| `archetype_code` | TEXT nullable | |
| `relevance_status` | TEXT nullable | |
| `relevance_json` | JSONB nullable | full `RelevanceDecision` |
| `fit_json` | JSONB nullable | full `FitScorecard` |
| `fit_total` | NUMERIC nullable | |
| `combined_score` | NUMERIC nullable | |
| `final_rank` | INT nullable | |
| `is_selected` | BOOLEAN default false | |
| `deep_research_run_id` | UUID nullable FK → `analysis_runs.id` | If handoff created |

**Indexes:** `(campaign_id, orgnr)` unique; `(campaign_id, is_selected)`; `(campaign_id, final_rank)`.

### 6.4 Optional: `screening_campaign_evidence`

If evidence rows are large, store normalized evidence snippets here instead of bloating `relevance_json`. FK to `campaign_id` + `orgnr` + `url`.

---

## 7. JSON contracts (LLM)

All LLM stages use **strict JSON schema** (OpenAI structured outputs) with `additionalProperties: false`.

### 7.1 Shared enums

- `relevance_status`: `in_mandate` | `out_of_mandate` | `uncertain`
- `risk_flag`: `low` | `medium` | `high`

### 7.2 `RelevanceDecision` (Layer 1)

```json
{
  "orgnr": "string",
  "status": "in_mandate | out_of_mandate | uncertain",
  "confidence": 0.0,
  "primary_business_summary": "string",
  "reason_codes": ["string"],
  "contradictions": "string | null",
  "evidence": [
    { "url": "string", "title": "string", "support_strength": "strong | weak" }
  ]
}
```

### 7.3 `FitScorecard` (Layer 2)

Dimensions should map to your thesis; **start with 5–7 fixed fields** + `notes`:

- `strategic_fit` (0–100)
- `financial_quality` (0–100) — interpret **only** from provided metrics, no invented numbers
- `value_creation_potential` (0–100)
- `complexity_risk` (0–100) — higher = worse
- `overall_fit` (0–100)
- `headline`: string
- `kill_switch` — boolean (if true, force reject unless human override)

---

## 8. API outline

All routes require Postgres (`DATABASE_SOURCE=postgres`) and existing auth patterns (`dependencies.get_current_user_id`).

### 8.1 Create campaign

`POST /api/screening/campaigns`

Body:

```json
{
  "name": "Q1 2026 universe pass",
  "profileId": "uuid",
  "profileVersionId": null,
  "params": {
    "layer0Limit": 2000,
    "layer1Limit": 800,
    "layer2Limit": 300,
    "finalShortlistSize": 100,
    "policy": { "uncertainRelevance": "reject" },
    "scoreWeights": { "deterministic": 0.4, "fit": 0.6 }
  },
  "filters": [],
  "overrides": { "mandateSummary": "optional free text" }
}
```

Response: `{ "campaignId": "uuid", "status": "draft" }`

### 8.2 Start / resume / pause

- `POST /api/screening/campaigns/{id}/start`
- `POST /api/screening/campaigns/{id}/pause`
- `POST /api/screening/campaigns/{id}/resume`

Worker picks up `running` campaigns (see §9).

### 8.3 Status

`GET /api/screening/campaigns/{id}`

Returns campaign row + current stage + counts + last error.

### 8.4 Results

`GET /api/screening/campaigns/{id}/candidates?layer=&selectedOnly=true&limit=&offset=`

### 8.5 Export

`GET /api/screening/campaigns/{id}/export.csv` (optional v1)

---

## 9. Execution model (worker)

- **Idempotency:** Re-running a stage for the same campaign/orgnr **updates** the candidate row, does not duplicate.
- **Batching:** Layer 1 and 2 process in batches (e.g. 10–25 companies) with rate limits; persist progress per batch in `screening_campaign_stages.stats_json`.
- **Failure:** Stage fails soft: mark `failed`, set `error_message`, leave partial candidates for inspection; `resume` continues from last incomplete batch (store `cursor` in stage row).

Implementation can use:

- Existing worker loop in `backend/orchestrator/worker.py` **or** a dedicated Celery/RQ job later — **spec does not mandate** job framework; require a single entrypoint function `run_screening_campaign_step(campaign_id)`.

---

## 10. Module layout (proposed)

```text
backend/
  services/
    screening_orchestrator/
      __init__.py
      campaign_service.py      # CRUD + state transitions
      layer0_sql.py            # cohort + rank using shared universe SQL
      layer1_relevance.py      # retrieval + LLM
      layer2_fit.py            # LLM
      layer3_select.py         # deterministic merge + diversification
      mandate_compiler.py      # config_json + overrides → mandate block
      schemas.py               # Pydantic models for API + LLM JSON
  api/
    screening_campaigns.py     # FastAPI router
```

**Dependency rule:** `screening_orchestrator` may call `backend/services/web_intel/` and `backend/llm/` helpers; it must **not** import deep-research agents for screening stages.

---

## 11. Traceability & claims (bounded)

- Screening outputs are **decision support**, not published research reports.
- Still store **evidence URLs/snippets** for Layer 1/2 so humans can audit.
- Optional later: map strong claims to `claims` table — **not required** for v1.

---

## 12. Acceptance criteria (v1)

1. Create campaign with existing profile → Layer 0 produces deterministic ranked candidates with `profile_weighted_score` matching `/api/universe/query` logic for the same profile (spot-check 20 orgnrs).
2. Layer 1 returns structured JSON; failed LLM parse does not corrupt DB (transaction per batch).
3. Final shortlist size respects `finalShortlistSize` and persists `is_selected`.
4. Pause/resume does not duplicate work (verified by counts + logs).
5. No Tavily usage outside `web_intel` service layer.

---

## 13. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **P0** | Migrations + CRUD API + Layer 0 only (SQL rank + cap) |
| **P1** | Layer 1 relevance + evidence persistence |
| **P2** | Layer 2 fit + Layer 3 selection + export |
| **P3** | Handoff hook to existing Deep Research run creation |

---

## 14. Open questions (track in `open_questions.md`)

- Diversification: segment bucketing — use `segment_names` JSON only or join another table?
- Cost caps: max LLM $ per campaign?
- Reuse vs extract: should `_build_universe_source_subquery` move to a shared module to avoid drift with `universe.py`?

---

## 15. Implementation checklist (backend + frontend)

Use this as the execution order for shipping campaigns end-to-end (including UI). Check items off in PRs.

### 15.1 Contracts & prerequisites

- [ ] **API prefix:** `POST/GET /api/screening/campaigns` (and sub-routes per §8); document request/response DTOs.
- [ ] **Auth:** Same as other Postgres routes (`get_current_user_id`, `REQUIRE_AUTH` behavior).
- [ ] **Env:** `DATABASE_SOURCE=postgres` for campaigns; document in runbook.

### 15.2 Backend P0 — vertical slice (DB + Layer 0 + read API)

- [x] **Migration:** `screening_campaigns`, `screening_campaign_stages`, `screening_campaign_candidates` — `database/migrations/038_screening_campaigns.sql` (also listed in `scripts/run_postgres_migrations.sh`).
- [x] **Service:** `backend/services/screening_orchestrator/` — `layer0.py` + `campaign_service.py` (Layer 0 uses `execute_universe_query` from `backend/api/universe.py`).
- [x] **Router:** `backend/api/screening_campaigns.py` — `POST /api/screening/campaigns`, `GET .../campaigns`, `GET .../{id}`, `POST .../{id}/start`, `GET .../{id}/candidates`, pause/resume (resume = re-run Layer 0).
- [x] **Wire:** `backend/api/main.py` includes `screening_campaigns.router`.
- [ ] **Verify:** curl/Bruno — create + start → rows in DB; scores align with `/api/universe/query` for same `profileId` (spot-check ~20 orgnrs).

### 15.3 Frontend P0 — show campaign output

- [x] **Client + types:** `frontend/src/lib/api/screeningCampaigns/` (`types.ts`, `service.ts`).
- [x] **UI:** `frontend/src/pages/default/ScreeningCampaignsPage.tsx` — route `/screening-campaigns`, nav **Screening campaigns** in `AppLayout`.
- [ ] **Acceptance:** After start, UI lists candidates sorted by rank/score without timeouts (keep Layer 0 fast or async; see §15.4).

### 15.4 Backend P1 — async execution + status

- [ ] **Worker:** `run_screening_campaign_step(campaign_id)` from worker loop (`backend/orchestrator/worker.py` or equivalent) so HTTP does not block on large Layer 0 / future LLM stages.
- [ ] **GET campaign:** Return `status`, current stage, counts (`layer0_done`, etc.).
- [ ] **Frontend polling:** `refetchInterval` while `status === 'running'` (or SSE later).

### 15.5 Backend P2 — LLM stages + shortlist

- [ ] **Layer 1:** Relevance via `WebRetrievalService` / `web_intel` only; persist `relevance_json` + evidence refs.
- [ ] **Layer 2:** Fit scorecard → `fit_json`, `fit_total`.
- [ ] **Layer 3:** `combined_score`, diversification (optional v1), `is_selected`, `final_rank`.
- [ ] **Export (optional):** `GET .../export.csv`.

### 15.6 Frontend P1 — full campaign UX

- [ ] Campaign **list** (history) + **create** form with **profile** picker (`GET /api/screening/profiles`).
- [ ] **Progress** UI per stage; extend table with relevance, fit, selected columns.
- [ ] **Export** button if CSV route exists.

### 15.7 Handoff (P3)

- [ ] **Deep Research:** Action on selected rows → existing create-run API (per `orgnr` / company id); store `deep_research_run_id` on candidate when created.

### 15.8 Legacy paths (integration note)

- [ ] **Canonical flow:** New UI calls **`/api/screening/campaigns`** only for universe campaigns.
- [ ] **Deprecate or document** overlap with `/api/ai-analysis` screening mode and any Supabase/enhanced-server screening if still in use — avoid two sources of truth for the same product surface.

---

*Document version: 1.2 — screening campaign orchestrator for large static universes (P0 backend + UI implemented).*
