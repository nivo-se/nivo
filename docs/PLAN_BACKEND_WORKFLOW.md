# Backend workflow: find companies, lists, AI analytics (updated plan)

## Principles

- **Lists:** Stored in Postgres only (`saved_lists` + `saved_list_items`). Each list is saved by the user who created it. The creator can mark a list as **Public** so it is visible to all users; otherwise it stays private (or team).
- **AI analysis:** All runs (Pipeline and AI Insights) are saved once in the **global** Postgres DB. Every user can see and reuse results; we never run the same analysis twice. `created_by` is kept for attribution only; run lists are not filtered by user.

---

## Current state (high level)

- **Find companies:** Universe + filters (Postgres).
- **Lists:** Postgres `saved_lists` / `saved_list_items` with `scope IN ('private', 'team')`. No "Public" option.
- **Pipeline analysis:** 3-stage workflow writes to `acquisition_runs`, `company_research`, `company_analysis`. Runs list returns all runs (no user filter).
- **AI Insights:** POST returns screening/deep in response only; nothing persisted, so runs cannot be reused.

---

## Changes (high level)

### 1. Lists: owner + Public option

- **Schema:** Allow `scope = 'public'` on `saved_lists` (migration: extend CHECK to `('private', 'team', 'public')` or add column `is_public`; recommend adding `'public'` to scope).
- **API:**  
  - Create/update list: accept `scope: 'public'` so the creator can mark a list as visible to everyone.  
  - GET lists: for "all" or "public", return lists where the user is the owner **or** `scope = 'team'` **or** `scope = 'public'`. So Public lists are visible to all users.
- **Frontend:** Add a "Public" control (e.g. checkbox) when creating/editing a list; when set, send `scope: 'public'`.

### 2. AI analysis: global storage, no user filtering

- **Storage:** Keep saving every run (Pipeline and, after implementation, AI Insights) to `acquisition_runs` and `company_analysis` in the **global** DB. No per-user partition of results.
- **Attribution:** Keep `created_by` on `acquisition_runs` (set from the requesting user) so we know who ran what; use for display only, not for filtering.
- **Runs list:** GET `/api/analysis/runs` returns **all** runs (no filter by `created_by`). All users see the same run list and can open any run and reuse results. Prevents running the same analysis twice and lets everyone benefit.
- **AI Insights persistence:** When POST `/api/ai-analysis` completes, write the run and per-company results into `acquisition_runs` and `company_analysis` (same as Pipeline). GET by `runId` reads from DB so past runs are available to everyone.

### 3. Schema and status

- **Migrations:** Ensure analysis tables exist (migration 018 or equivalent). Add migration for list `scope = 'public'` (or `is_public`) as above.
- **Status:** Include `acquisition_runs` / `company_analysis` in health or readiness so it’s clear when analysis is available.

---

## Summary

| Area | Change |
|------|--------|
| Lists | Postgres only; list saved by creator; add **Public** so list is visible to all users. |
| Analysis runs | All runs saved in **global** Postgres DB; all users see all runs and reuse results; `created_by` for attribution only. |
| AI Insights | Persist to same global tables; GET by runId for history; no duplicate runs. |

---

## Out of scope

- Deep-dive AI on a smaller set (next phase).
