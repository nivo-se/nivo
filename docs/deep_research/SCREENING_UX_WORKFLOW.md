# Screening UX workflow (current) + suggested improvements

## Full workflow today (end-to-end)

### 0. Preconditions
- Backend + Postgres up; migrations through **041** (SNI columns, candidate exclusions).
- User signed in (**Auth0**) if `REQUIRE_AUTH=true`.
- Optional: screening **preset profiles** seeded (**039**).

### 1. Configure screening profiles (optional)
- **Route:** `/screening-campaigns`
- **Actions:** **New** / **Edit** next to “Screening profile”
- **Content:** Name, scope (private/team), **Layer 1 JSON** (`variables`, `weights`, `archetypes`, `exclusion_rules`)
- **Persistence:** `screening_profiles` + `screening_profile_versions` (versioned; activate = active config)

### 2. Create a campaign
- **Fields:** Campaign name, **profile** (dropdown), **Layer 0 cap** (how many top rows to keep after rank)
- **SNI / NACE hygiene:** Checkboxes for common **prefix exclusions** (e.g. 49 transport, 64 finance) + optional extra prefixes
- **Create draft** → row in **`screening_campaigns`** with **`config_snapshot_json`** (profile copy) + **`params_json`** (filters, cap, etc.)

### 3. Run Layer 0 (deterministic shortlist)
- Select campaign → **Run Layer 0**
- **Behavior:** Universe query + profile score sort → top **N** → **`screening_campaign_candidates`**
- **Results table:** Rank, orgnr, **clickable** name/org → **`/company/:orgnr`**, **Primary SNI**, score, archetype

### 4. Human triage on the shortlist
- **Skip** checkbox → **`excluded_from_analysis`** (drops from downstream enrichment resolution; reason stored)
- **Why:** Head offices, holdings, wrong entity — financials alone aren’t enough

### 5. Public / structured enrichment (batch)
- **Enrich public data** → **`POST /api/enrichment/run`** with **`campaignId`**
- **Behavior:** All candidates **except** skipped → existing **enrichment worker** (homepage + LLM kinds → **`company_enrichment`** / **`ai_profiles`**)
- **Stored runs:** Each batch creates **`enrichment_runs`** with **`meta.campaign_id`** (and orgnr list). **`GET /api/enrichment/runs?campaignId=…`** lists recent runs; the screening UI shows **Recent enrichment runs** per selected campaign + **Status** (polls **`GET /api/enrichment/run/{run_id}/status`**).
- **Read:** Company page + **`GET /api/companies/{orgnr}/intel`**

### 6. Deeper research (manual handoff to step 7)
- **Not auto-chained** from screening (you choose when to spend on a full DR run).
- **From the candidates table:** **Research** opens **`/deep-research`** with query params (`orgnr`, `from=screening`, optional `name`, `campaign`) → **New report** wizard opens with company resolved from the universe DB by org.nr (same identity as screening).
- **From company profile** (`/company/:orgnr`): **Deep Research** button uses `from=company` + name/website when available.
- Full DR pipeline remains on **`/deep-research`** (runs, workbench, reports).

---

## Data model reminder (UX implications)

| User concept | Storage |
|--------------|---------|
| “My scoring recipe” | `screening_profile_versions.config_json` |
| “This run’s recipe + filters” | `screening_campaigns` snapshot + `params_json` |
| “Who made the cut” | `screening_campaign_candidates` |
| “Skip for later stages” | `excluded_from_analysis` on candidate row |
| “Products / about / market text” | **`company_enrichment`** per orgnr — **not** inside profile JSON |

---

## Manual QA checklist

See **[QA_SCREENING.md](./QA_SCREENING.md)** for a short end-to-end verification script (profile → campaign → Layer 0 → enrich → company → Deep Research).

## Suggested improvements (prioritized)

### P0 — Clarity & trust
1. **Onboarding strip** on `/screening-campaigns`: 3 steps — *Profile → Layer 0 → Enrich* with links to this doc.
2. **Empty states:** No profile → CTA “Create profile”; Layer 0 not run → disable “Enrich public data” with tooltip (already partially there).
3. **Enrichment run visibility:** **Done (in-app):** recent runs per campaign + **Status** toast; see **`GET /api/enrichment/runs?campaignId=…`**.

### P1 — Triage velocity
4. **Bulk Skip** (select many → exclude) or **“Skip all without primary SNI”** (optional, dangerous — confirm dialog).
5. **Reason presets** for exclusion (Head office, Holding, Wrong industry) instead of single default string.
6. **Filter table:** hide skipped / show only skipped / search by name.

### P2 — Intelligence without noise
7. **Warning badge** when `primary_nace` is empty — “Industry unknown; confirm before investing research time.”
8. **Parent / group** field (when data exists) next to name — requires backend data later.
9. **Campaign summary card:** “X candidates, Y skipped, Z enriched” with last enrichment run id.

### P3 — Pipeline integration
10. **Optional auto-enrich** after Layer 0 completes (feature flag + cap, e.g. max 50 orgs).
11. **Push shortlist to saved list** or **Deep Research batch** in one click (creates list + navigates).
12. **Layer 1+** in orchestrator: respect `excluded_from_analysis` everywhere (jobs + UI).

### P4 — Ops
13. **Redis down:** Show banner “Enrichment will run synchronously / queue unavailable” when `/api/status` shows Redis error.
14. **Rate limits:** Show estimated time for large batches (N × avg seconds).

---

## What we are *not* solving in this screen alone

- **Corporate tree** (Epiroc vs Sandvik entities) — needs structured data + UX for “operating unit vs HQ”.
- **Tavily-first discovery** — use **after** shortlist + deterministic fetch; see `SCREENING_DATA_AND_ENRICHMENT.md`.

---

*Last updated to match screening campaigns + enrichment `campaignId` integration.*
