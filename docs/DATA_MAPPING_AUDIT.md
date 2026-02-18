# Data Mapping Audit — Universe + Company Profile

**Mission:** Audit and fix missing data in the UI by mapping every "— / empty" field to existing DB fields or derived metrics. No new enrichment. Goal: Universe table + Company Profile show the data we already have.

---

## Step 0 — Endpoints + Data Model

### Universe Table

| Item | Path |
|------|------|
| **Route** | `/universe` |
| **Frontend page** | `frontend/src/pages/new/Universe.tsx` |
| **Frontend hook** | `useCompaniesWithTotal` from `frontend/src/lib/hooks/apiQueries.ts` |
| **Frontend API** | `getCompaniesWithTotal` → `queryUniverse` from `frontend/src/lib/services/universeQueryService.ts` |
| **API endpoint** | `POST /api/universe/query` |
| **Backend route** | `backend/api/universe.py` — `universe_query()` |
| **SQL source** | `coverage_metrics` view (no raw table; view over `companies`, `ai_profiles`, `company_kpis`) |

**Data flow:** `Universe.tsx` → `useCompaniesWithTotal` → `getCompaniesWithTotal` → `queryUniverse` (POST `/api/universe/query`) → backend queries `coverage_metrics` → response mapped via `mapUniverseRowToCompany` (in `compatClient.ts`).

### Company Profile

| Item | Path |
|------|------|
| **Route** | `/company/:companyId` (e.g. `/company/5565859138`) |
| **Frontend page** | `frontend/src/pages/new/CompanyDetail.tsx` |
| **Frontend hooks** | `useCompaniesBatch`, `useCompany`, `useCompanyFinancials`, `useCompanyAIProfile` |
| **API endpoints** | `POST /api/companies/batch`, `POST /api/universe/query` (single), `GET /api/companies/{orgnr}/financials`, `GET /api/analysis/companies/{orgnr}/analysis` |
| **Backend routes** | `backend/api/companies.py` (batch, financials), `backend/api/universe.py` (query), `backend/api/analysis.py` (AI analysis) |
| **DB tables** | `companies`, `company_kpis`, `financials`, `ai_profiles`, `company_analysis` (via analysis workflow) |

**Data flow:** `CompanyDetail.tsx` uses batch first, then `useCompany` (universe query) as fallback; financials from `/api/companies/{orgnr}/financials`; AI profile from `/api/analysis/companies/{orgnr}/analysis`.

### DB Tables Referenced

| Table | Role |
|-------|------|
| `companies` | Base company data (name, homepage, email, phone, address, segment_names, employees_latest) |
| `company_kpis` | Aggregated metrics (revenue, EBITDA, margins, CAGR) |
| `financials` | Row-per-year financials (revenue, EBITDA, EBIT, etc.) |
| `ai_profiles` | AI-enriched profiles (strategic fit, summaries, etc.) |
| `coverage_metrics` | View over `companies` + `ai_profiles` + `company_kpis`; used by Universe |
| `company_analysis` | Per-run analysis results (via analysis API) |

---

## Step 1 — Missing Data Audit Checklist (from UI)

### Universe columns

| Column | UI field | Source / mapping | Status |
|--------|----------|------------------|--------|
| Company Name | `company_name` | `coverage_metrics.name` → `display_name` | ✅ Mapped |
| Industry | `industry` | `coverage_metrics.segment_names[0]` → `industry_label` | ✅ Mapped |
| Geography | `geography` | coverage_metrics.municipality → `region` | ✅ Fixed (migration 019) |
| Revenue | `revenue_latest` | `coverage_metrics.revenue_latest` → `revenue_latest` | ✅ Mapped |
| 3Y CAGR | `cagr_3y` | `coverage_metrics.revenue_cagr_3y` → `revenue_cagr_3y` | ✅ Mapped |
| EBITDA Margin | `ebitda_margin_latest` | `coverage_metrics.ebitda_margin_latest` | ✅ Mapped |
| Flags | `flags` | `status`, `has_3y_financials` — client-side from `company` | ⚠️ Partial (no threshold-derived flags) |
| AI | `ai` | coverage_metrics.ai_strategic_fit_score → `ai_profile` | ✅ Fixed (migration 019) |

**Universe gaps (fixed in Step 2):** geography, contact, and AI now come from coverage_metrics (migration 019).

### Company Profile sections

| Section | UI fields | Source / mapping | Status |
|---------|-----------|------------------|--------|
| **Identity** | | | |
| Org nr | `company.orgnr` | Batch / Universe | ✅ |
| Industry | `company.industry_label` | `segment_names[0]` | ✅ |
| Region / geography | `company.region` | Batch + Universe (coverage_metrics.municipality) | ✅ |
| Employees | `company.employees_latest` | `coverage_metrics.employees_latest` / `companies.employees_latest` | ✅ |
| Website | `company.website_url` | Batch + Universe (coverage_metrics.homepage) | ✅ |
| Email | `company.email` | Batch + Universe (coverage_metrics.email) | ✅ |
| Phone | `company.phone` | Batch + Universe (coverage_metrics.phone) | ✅ |
| **Financials (Overview)** | | | |
| Revenue (Latest) | `latest.revenue` | Batch/Universe + merged from `company_kpis` / universe | ✅ |
| 3Y CAGR | `cagr` | `revenue_cagr_3y` | ✅ |
| EBITDA Margin | `latest.ebitdaMargin` | `avg_ebitda_margin` | ✅ |
| EBITDA (Latest) | `latest.ebitda` | Derived or from `company_kpis` | ✅ |
| **Financials (History)** | | | |
| Multi-year table | `financials[]` | `GET /api/companies/{orgnr}/financials` → `financials` table; fallback from `company_kpis` | ✅ (with fallback) |
| **Growth** | | | |
| Revenue Growth YoY | `company.revenue_growth_yoy_latest` | Batch: `company_kpis.revenue_growth_yoy` | ⚠️ From batch |
| EBITDA Growth YoY | Derived from `financials` | Multi-year diff | ✅ |
| Employee Growth YoY | — | **Not implemented** | ❌ |
| **AI** | | | |
| AI Investment Score | `aiProfile.ai_fit_score` | `GET /api/analysis/companies/{orgnr}/analysis` | ✅ (when analysis exists) |
| AI summary/verdict | `aiProfile.latest_result` | Same endpoint | ✅ |
| **Balance sheet** | | | |
| Assets, equity, liabilities, net debt | — | **No balance sheet tables in schema** | ❌ Not in DB |
| **Derived metrics** | | | |
| Equity ratio, leverage | `company.equity_ratio_latest`, `debt_to_equity_latest` | Batch + Universe; CompanyDetail displays | ✅ Fixed |
| **Data quality** | | | |
| Data quality score | `company.data_quality_score` | Universe: `coverage_metrics.data_quality_score` | ✅ (Universe) |
| Last updated | `company.last_enriched_at` | Universe: `ai_profiles.last_updated` | ✅ (Universe) |

### Summary: Actual missing vs not-wired (post Step 2)

| Category | Status | Notes |
|----------|--------|-------|
| **Universe geography** | ✅ Fixed | coverage_metrics.municipality |
| **Universe AI column** | ✅ Fixed | ai_strategic_fit_score → ai_profile with badge |
| **Universe Flags** | Partial | Uses `has_3y_financials`, `status`; no threshold-derived flags |
| **Company Profile region/contact** | ✅ Fixed | Batch + Universe (coverage_metrics) |
| **Company Profile equity/leverage** | ✅ Fixed | Batch + Universe; CompanyDetail displays |
| **Company Profile balance sheet** | Not in DB | No balance sheet tables |
| **Employee Growth YoY** | Not implemented | Requires employee history; not in schema |

---

## Step 2 — Mapping table (implemented)

### A) Universe table (`/universe`)

| UI field | SOURCE | JOIN KEY | NOTES |
|----------|--------|----------|-------|
| orgnr | coverage_metrics.orgnr | — | Primary identifier |
| company_name | coverage_metrics.name | — | Mapped |
| industry_label | coverage_metrics.segment_names[0] | — | Primary industry |
| revenue_latest | coverage_metrics.revenue_latest | — | SEK; UI formats to M/B |
| revenue_cagr_3y | coverage_metrics.revenue_cagr_3y | — | Ratio (0.08 = 8%) |
| ebitda_margin_latest | coverage_metrics.ebitda_margin_latest | — | Ratio (0.12 = 12%) |
| employees_latest | coverage_metrics.employees_latest | — | Present |
| data_quality_score | coverage_metrics.data_quality_score | — | 0–4 |
| has_ai_profile | coverage_metrics.has_ai_profile | — | Boolean |
| Geography | coverage_metrics.municipality | cm.orgnr = c.orgnr | **Fixed:** migration 019 adds `COALESCE(c.address->>'municipality', c.address->>'region')` |
| Contact (fallback) | coverage_metrics.homepage, email, phone | — | **Fixed:** migration 019 adds from `companies` |
| AI summary/score | coverage_metrics.ai_strategic_fit_score | — | **Fixed:** migration 019 adds from `ai_profiles`; UI shows badge + score tooltip |

### B) Company Profile (`/company/:orgnr`)

| UI field | SOURCE | JOIN KEY | NOTES |
|----------|--------|----------|-------|
| orgnr, company_name | companies | — | Batch + Universe fallback |
| industry_label | companies.segment_names[0] | — | Same rule as Universe |
| region/municipality | companies.address->>'municipality' | orgnr | Batch + Universe (via coverage_metrics) |
| website_url, email, phone | companies.homepage, email, phone | orgnr | Batch + Universe (via coverage_metrics) |
| employees_latest | companies.employees_latest | orgnr | Shown |
| revenue_latest, ebitda_* | company_kpis | orgnr | Batch + Universe |
| multi-year financials | financials.* | orgnr | Via `/api/companies/{orgnr}/financials` + company_kpis fallback |
| AI fit/verdict | /api/analysis/companies/{orgnr}/analysis | orgnr | When analysis exists |
| equity_ratio_latest | company_kpis.equity_ratio_latest | orgnr | **Fixed:** batch + Universe; CompanyDetail displays |
| debt_to_equity_latest | company_kpis.debt_to_equity_latest | orgnr | **Fixed:** batch + Universe; CompanyDetail displays |

### Implementation summary (Step 2 task list)

| Task | Status | Files touched |
|------|--------|---------------|
| 1. Universe geography | ✅ | `019_coverage_metrics_add_municipality_contact_ai.sql`, `universe.py`, `universeQueryService.ts`, `compatClient.ts` |
| 2. Universe AI column (Option B) | ✅ | Same migration + `mapUniverseRowToCompany` builds `ai_profile` with `ai_fit_score`, `ai_badge` |
| 3. Company Profile equity/leverage | ✅ | `companies.py` (batch), `compatClient.ts` (mapBatchRowToCompany), `CompanyDetail.tsx`, coverage_metrics |
| 4. Contact fields consistent | ✅ | coverage_metrics now includes homepage, email, phone; fallback path populated |

---

## Endpoints reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/universe/query` | POST | Universe table data (filtered, sorted, paginated) |
| `/api/universe/filters` | GET | Filter taxonomy for Universe UI |
| `/api/companies/batch` | POST | Company detail for multiple orgnrs (includes contact, financials) |
| `/api/companies/{orgnr}/financials` | GET | Multi-year financial history |
| `/api/analysis/companies/{orgnr}/analysis` | GET | AI analysis / strategic fit |

---

*Step 0–2 complete. Steps 3–5 (backend fixes validation, frontend wiring validation, dev debug accordion) to follow.*
