# Nivo Backend App – Implementation Plan

**Aligned with:** [BACKEND_APP_UX_CONCEPT.md](BACKEND_APP_UX_CONCEPT.md), [BACKEND_UX_SCHEMATIC_FOR_CHATGPT.md](BACKEND_UX_SCHEMATIC_FOR_CHATGPT.md)

**Schema source:** `database/local_postgres_schema.sql`, `backend/api/*.py`

---

## 1. Route Map + Component List

### New Routes (React Router)

| Route | Component | Replaces / Uses |
|-------|-----------|------------------|
| `/app` | `AppLayout` (shell with nav) | New parent for all app routes |
| `/app/home` | `HomePage` | New – CEO dashboard |
| `/app/universe` | `UniversePage` | AISourcingDashboard + WorkingDashboard "Företagssökning" + FinancialFilterPanel |
| `/app/pipeline` | `PipelinePage` | acquisition_runs, saved_company_lists, stage flows |
| `/app/companies/:orgnr` | `CompanyDetailPage` | CompanyDetail (enhanced) |
| `/app/reports` | `ReportsPage` | Valuation exports + new IC memo / teaser |
| `/app/runs` | `RunsPage` | New – enrichment runs, jobs, failures |
| `/app/admin` | `AdminPage` | Admin (existing, refined) |
| `/dashboard` | → redirect to `/app/universe` | Backward compat |
| `/valuation` | → redirect to `/app/reports` or embed | Backward compat |
| `/analysis` | → redirect to `/app/pipeline` | Backward compat |

### Component Inventory

| Component | Purpose | Data Sources |
|-----------|---------|--------------|
| `AppShell` | Layout + left nav (7 items) | - |
| `HomePage` | CEO widgets | `/api/status`, `/api/coverage` (new), `/api/runs` (new) |
| `UniversePage` | Table + filters + insights | `/api/filters/apply`, `/api/filters/analytics`, `/api/coverage` |
| `UniverseTable` | Company table | Batch fetch with include_ai |
| `UniverseFilters` | Financial + completeness + AI | - |
| `UniverseInsights` | Charts panel | Filter analytics response |
| `CoverageModeToggle` | "Targets" vs "Missing" | Coverage API |
| `PipelinePage` | Kanban / stages | `/api/saved-lists`, `/api/analysis/runs`, acquisition runs |
| `PipelineBoard` | Columns + cards | saved_company_lists, company_research, company_analysis |
| `CompanyDetailPage` | 5-tab detail | `/api/companies/{id}/intel`, `/api/companies/{id}/financials`, ai-report |
| `ReportsPage` | Report library + exports | ai_report_service, export service |
| `RunsPage` | Enrichment jobs list | `/api/enrichment/run/{id}/status`, `/api/jobs/` |
| `AdminPage` | Users, integrations, health | AdminPanel + `/api/status/config` |

---

## 2. Queries Powering Key Widgets

### Home – Universe Snapshot

```sql
-- Total companies
SELECT COUNT(*) FROM companies;

-- With KPIs (has company_kpis row)
SELECT COUNT(*) FROM company_kpis;

-- With AI profile
SELECT COUNT(*) FROM ai_profiles;

-- With website (homepage or ai_profiles.website)
SELECT COUNT(*) FROM companies c
LEFT JOIN ai_profiles a ON c.orgnr = a.org_number
WHERE c.homepage IS NOT NULL AND c.homepage != '' OR a.website IS NOT NULL;

-- Missing key fields (coverage)
-- has_homepage, has_ai_profile, has_3y_financials from coverage view
```

**API:** `GET /api/coverage/snapshot` (new)

### Home – Pipeline Snapshot

```sql
SELECT stage, status, COUNT(*) FROM acquisition_runs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY stage, status;
```

**API:** `GET /api/analysis/snapshot` (extend existing)

### Universe – Company Table (with filters)

Existing: `POST /api/filters/apply` with weights, percentile cutoffs.

Extend: Add `completeness` filters (has_homepage, has_ai_profile, has_3y_financials).

**Fields for columns:**
- companies: orgnr, company_name, segment_names, nace_codes, homepage, employees_latest
- company_kpis: latest_revenue_sek, latest_ebitda_sek, revenue_cagr_3y, avg_ebitda_margin, company_size_bucket, growth_bucket, profitability_bucket
- ai_profiles: strategic_fit_score, defensibility_score, industry_sector, last_updated

### Universe – Charts

Existing: `GET /api/filters/analytics` returns percentiles, scatter_data, density_data.

Use: `scatter_data` (x, y, orgnr, name), `percentiles` for distributions.

### Coverage View (Data Coverage Mode)

```sql
-- coverage_metrics materialized view (see Section 4)
SELECT orgnr, has_homepage, has_ai_profile, has_3y_financials,
       last_enriched_at, data_quality_score
FROM coverage_metrics
WHERE has_homepage = false OR has_ai_profile = false OR ...
```

### Runs & Jobs

Existing: `GET /api/enrichment/run/{id}/status`, `GET /api/jobs/{id}`, `GET /api/jobs/`

Extend: List runs with failure summary, link to company_enrichment + enrichment_runs.meta

---

## 3. Minimal DB Additions

### A) Coverage Metrics View (materialized or computed)

```sql
CREATE OR REPLACE VIEW public.coverage_metrics AS
SELECT
  c.orgnr,
  (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
  (a.org_number IS NOT NULL) AS has_ai_profile,
  (SELECT COUNT(DISTINCT year) FROM financials f
   WHERE f.orgnr = c.orgnr) >= 3 AS has_3y_financials,
  a.last_updated AS last_enriched_at,
  (
    CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END +
    CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END +
    CASE WHEN (SELECT COUNT(DISTINCT year) FROM financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END
  ) AS data_quality_score
FROM companies c
LEFT JOIN ai_profiles a ON c.orgnr = a.org_number;
```

### B) Enrichment Freshness (stale = > 180 days)

```sql
-- Add to coverage or computed in API
last_enriched_at < NOW() - INTERVAL '180 days' AS is_stale
```

### C) Optional: acquisition_runs stage summary

If `acquisition_runs` exists with stage/status, use. Else add migration for stage1/2/3 counts.

---

## 4. MVP Sequence

### Week 1: Universe + Coverage

1. Add `GET /api/coverage/snapshot` – counts (total, with KPIs, with AI, with website, missing key)
2. Add `coverage_metrics` view (or equivalent query)
3. Build `UniversePage` with:
   - Segment chips (from segment_names, company_size_bucket, growth_bucket)
   - Left filters (financial weights + completeness)
   - Company table (reuse CompanyExplorer or EnhancedCompanySearch logic)
   - Data Coverage Mode toggle → filter by missing fields
4. Wire `/app/universe` and redirect `/dashboard` → `/app/universe`
5. Build `AppShell` with 7-item nav; `/app` → `/app/home` default

### Week 2: Pipeline

1. Map `saved_company_lists` + `acquisition_runs` to Pipeline board columns
2. Build `PipelinePage` with Inbox, Stage 1/2/3, cards
3. Batch actions: Enrich (→ `/api/enrichment/run`), Export (existing)
4. Create "IC pack" = export selected to PDF/Sheets (stub or basic)
5. Wire `/app/pipeline`

### Week 3: Reports

1. Consolidate Valuation + Export into `ReportsPage`
2. Add IC memo template (pull from companies, kpis, ai_profiles)
3. Founder teaser one-pager template
4. Copper export (existing), Sheets export, PDF export
5. Wire `/app/reports`

### Week 4: Runs & Jobs + Admin

1. Build `RunsPage` – list enrichment runs, status, failures
2. Per-run: link to companies, retry failed
3. Jobs list from `/api/jobs/`
4. Refine Admin: add Integrations health (Copper, SerpAPI, Puppeteer, Redis), Data health (from /api/status)
5. Wire `/app/runs`, `/app/admin`, `/app/home`

### Week 5: Home + Polish

1. Home widgets: Universe snapshot, Pipeline snapshot, active runs
2. Top signals (query for high-growth+margin, newly enriched high-fit)
3. Redirects for old routes
4. Polish nav, empty states, loading

---

## 5. Field Mapping (Canonical → UI)

| UI Concept | DB Field(s) |
|------------|-------------|
| Company name | companies.company_name |
| Revenue | company_kpis.latest_revenue_sek |
| EBITDA | company_kpis.latest_ebitda_sek |
| EBITDA margin | company_kpis.avg_ebitda_margin |
| Net margin | company_kpis.avg_net_margin |
| Revenue growth (3y CAGR) | company_kpis.revenue_cagr_3y |
| Size bucket | company_kpis.company_size_bucket |
| Growth bucket | company_kpis.growth_bucket |
| Profitability bucket | company_kpis.profitability_bucket |
| Segment | companies.segment_names (JSONB) |
| NACE | companies.nace_codes (JSONB) |
| Website | companies.homepage, ai_profiles.website |
| Employees | companies.employees_latest |
| Strategic fit | ai_profiles.strategic_fit_score |
| Defensibility | ai_profiles.defensibility_score |
| Industry | ai_profiles.industry_sector |
| Last enriched | ai_profiles.last_updated, company_enrichment.created_at |
| Run provenance | enrichment_runs.id, enrichment_runs.source, enrichment_runs.created_at |

---

## 6. API Additions Required

| Endpoint | Purpose |
|----------|---------|
| `GET /api/coverage/snapshot` | Home + Universe: #companies, #with KPIs, #with AI, #with website, #missing |
| `GET /api/coverage/list?missing=homepage,ai_profile,...` | Universe Coverage Mode: companies missing selected fields |
| `GET /api/analysis/snapshot` | Home: stage counts, what moved this week |
| Extend `POST /api/filters/apply` | Add completeness_filters: { has_homepage?, has_ai_profile?, has_3y_financials? } |
| `GET /api/runs` or extend jobs | List enrichment runs with status, failure count |
| `POST /api/enrichment/run/{id}/retry` | Retry failed companies in a run (optional) |

---

## 7. Files to Create / Modify

| Action | Path |
|--------|------|
| Create | `frontend/src/layouts/AppShell.tsx` |
| Create | `frontend/src/pages/app/HomePage.tsx` |
| Create | `frontend/src/pages/app/UniversePage.tsx` |
| Create | `frontend/src/pages/app/PipelinePage.tsx` |
| Create | `frontend/src/pages/app/ReportsPage.tsx` |
| Create | `frontend/src/pages/app/RunsPage.tsx` |
| Modify | `frontend/src/pages/CompanyDetail.tsx` → move under `/app/companies/:orgnr` |
| Modify | `frontend/src/App.tsx` – add `/app/*` routes, redirects |
| Create | `backend/api/coverage.py` – coverage endpoints |
| Create | `database/migrations/013_add_coverage_view.sql` |
| Modify | `backend/api/filters.py` – add completeness filters |
| Modify | `frontend/src/lib/apiService.ts` – new API methods |
