# Screening profiles vs campaigns vs public enrichment

## Are profile JSONs stored in the “same list” as campaigns?

**No.** They are different tables and roles:

| Store | Table | What it holds |
|--------|--------|----------------|
| **Canonical profile (Layer 1 config)** | `screening_profiles` + `screening_profile_versions` | **`config_json`**: `variables`, `weights`, `archetypes`, `exclusion_rules`. Versioned; one **active** version per profile. |
| **One campaign run** | `screening_campaigns` | **`profile_id` / `profile_version_id`** (FK), **`config_snapshot_json`** (copy of the profile at create time), **`params_json`** (Layer 0 limits, filters, `q`, overrides). |
| **Shortlist rows** | `screening_campaign_candidates` | **Org numbers + scores + flags** (`excluded_from_analysis`, `layer0_rank`, …). **Not** profile JSON. |
| **Public / LLM enrichment** | `company_enrichment` (+ `ai_profiles`, etc.) | **Per-orgnr** artifacts: website text, `llm_analysis`, `company_profile`, … keyed by **orgnr** and **run_id**, not by screening profile. |

So:

- **Profile JSON** lives in **`screening_profile_versions.config_json`** (and a **snapshot** on the campaign for audit).
- **Campaign “list”** = rows in **`screening_campaign_candidates`** only.
- **Enrichment** (products, markets, about) is **per company**, not per profile, and **reuses the same enrichment pipeline** as other flows.

## How to implement “financials → public data” efficiently

### 1. **Reuse existing enrichment worker**

`backend/workers/enrichment_worker.py` fetches **homepage** (from `companies` / `ai_profiles`), scrapes text, and writes **`company_enrichment`** rows (kinds like `llm_analysis`, `company_profile`, `website_insights`). It does **not** use SerpAPI for discovery by default; you must already have a URL in DB.

### 2. **Wire screening → enrichment (implemented)**

- **`POST /api/enrichment/run`** accepts **`campaignId`** (camelCase) in the JSON body.
- Resolves **all orgnrs** from **`screening_campaign_candidates`** for that campaign, **excluding** rows with **`excluded_from_analysis = true`** (when migration `041` is applied).
- Enqueues the same batch job as list-based enrichment (RQ or sync fallback).

Example:

```json
POST /api/enrichment/run
{
  "campaignId": "<uuid>",
  "kinds": ["llm_analysis", "company_profile", "website_insights"]
}
```

Poll **`GET /api/enrichment/run/{run_id}/status`**.

Read enriched data via **`GET /api/companies/{orgnr}/intel`** (existing).

### 3. **Order of operations**

1. Create screening campaign → **Run Layer 0** → candidates stored.
2. **Mark “Skip”** on head offices / holding shells.
3. **`POST /api/enrichment/run`** with **`campaignId`** → public-style fields land in **`company_enrichment`** / **`ai_profiles`** as today.
4. Optional later: **Tavily / Deep Research** `WebRetrievalService` for **deeper** runs on a **smaller** subset (separate from this batch).

### 4. **What is *not* duplicated**

- Profile JSON is **not** copied into `company_enrichment`.
- Each enrichment run is **per orgnr**; multiple campaigns can reference the same **orgnr** and **share** the latest enrichment row (or `force_refresh` if you add it to the run API later).
