# Manual QA — Screening → Enrichment → Deep Research

Use this checklist after UX changes to the screening flow. Requires **Postgres** (`DATABASE_SOURCE=postgres`) and a running API.

## Auth

- With **`REQUIRE_AUTH=false`**: `/api/screening/*` and `/api/enrichment/*` work without a JWT; `/api/status` may still return full payload.
- With **`REQUIRE_AUTH=true`**: sign in (Auth0) first; unauthenticated calls should fail predictably with 401 where enforced.

## End-to-end path

1. **Profiles** — Open `/screening-campaigns`. Create a screening profile (New), save JSON config, confirm it appears in the profile dropdown after reload.
2. **Campaign** — Select profile, set Layer 0 cap, optional SNI exclusions, **Create draft**. Confirm new campaign appears in the list with status and created time.
3. **Layer 0** — Select campaign, **Run Layer 0**. Confirm success message shows human-readable counts (not raw JSON), and candidate table fills.
4. **Triage** — Toggle **Skip** on one row; confirm it persists after refresh (re-select campaign or Refresh).
5. **Enrichment** — **Enrich public data**. Confirm toast and a new row under **Recent enrichment runs**; expand or **Status** shows progress fields.
6. **Company** — Open a candidate link to `/company/:orgnr`. Confirm profile loads.
7. **Deep Research** — From screening row **Research** (or company **Deep Research**), confirm `/deep-research` opens the wizard with company pre-filled; complete or cancel without errors.

## Degraded backend (optional)

- Stop Redis or break Redis URL: confirm a **dismissible** warning appears on screening (and deep-research home if implemented) that enrichment may run synchronously or slowly.

## Regression

- **Refresh** campaigns list still works.
- No campaign selected: **Run & results** panel explains selection; no console errors.
