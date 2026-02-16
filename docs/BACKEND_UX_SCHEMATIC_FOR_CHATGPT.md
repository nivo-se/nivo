# Nivo Backend App – Schematic for UX Redesign

**Purpose:** Provide ChatGPT (or any designer) with a complete picture of our backend architecture, database structure, and scraping/enrichment workflow so we can design the best possible UX for the backend app.

**Scope:** Backend app = the authenticated internal app (dashboard, admin, analysis, company detail, valuation, export). The **front/landing page (`/`) stays untouched**.

---

## How to Use With ChatGPT

1. Copy this entire file (or share the path) with ChatGPT.
2. Prompt example: *"Using the schematic in BACKEND_UX_SCHEMATIC_FOR_CHATGPT.md, propose a reorganized backend app UX. The landing page stays as-is. Focus on: (a) simplifying navigation, (b) clearer data flow (scrape → enrich → explore), (c) better async job feedback (enrichment), (d) unifying valuation/analysis/admin into the main flow."*
3. Iterate: ask ChatGPT to produce wireframes, user flows, or component structure based on the schematic.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NIVO SYSTEM OVERVIEW                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐ │
│  │   Scraper    │────▶│   Staging SQLite      │────▶│  nivo_optimized.db      │ │
│  │ (Allabolag)  │     │ (scraper/.../staging) │     │  (create_optimized_db)  │ │
│  └──────────────┘     └──────────────────────┘     └────────────┬────────────┘ │
│                                                                  │              │
│                                                                  ▼              │
│  ┌──────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐ │
│  │ SerpAPI +    │     │  Enrichment Worker   │────▶│  ai_profiles            │ │
│  │ Puppeteer    │────▶│  (RQ background job) │     │  company_enrichment     │ │
│  └──────────────┘     └──────────────────────┘     └─────────────────────────┘ │
│                                                                  ▲              │
│                                                                  │              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  FRONTEND (React/Vite) – Backend App (authenticated)                         ││
│  │  /dashboard | /admin | /valuation | /companies/:orgnr | /analysis            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                        │                                         │
│                                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  BACKEND API (FastAPI) – localhost:8000 / Railway                            ││
│  │  /api/companies | /api/filters | /api/enrichment | /api/ai-reports | etc.    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow: Scrape → Optimized DB → Enrichment

### Phase 1: Scraping (Offline / Manual)

| Step | Tool | Input | Output |
|------|------|-------|--------|
| 1 | Allabolag scraper | Search queries, industry filters | Staging SQLite (`staging/staging_current.db`) |
| 2 | `create_optimized_db.py` | Staging DB | `data/nivo_optimized.db` with `companies`, `financials` |
| 3 | `create_kpi_table.py` | Optimized DB | Adds `company_kpis` (CAGR, margins, growth buckets) |

**Scraper workflow (simplified):**
1. Scraper fetches session/cookies from Allabolag.se
2. Searches companies by query/industry
3. For each company, fetches JSON: `https://www.allabolag.se/_next/data/{buildId}/company/{companyId}.json`
4. Parses `companyAccounts` → revenue (SDI), profit (DR), EBITDA (ORS), equity (EK), etc.
5. Writes to staging tables: `company_accounts_by_id`, `master_analytics` (or equivalent)
6. Optimization scripts flatten and derive KPIs into `nivo_optimized.db`

### Phase 2: Enrichment (On-Demand / Batch)

| Step | Service | Input | Output |
|------|---------|-------|--------|
| 1 | SerpAPI | Company name | Website URL (if not in `companies.homepage`) |
| 2 | Puppeteer | Website URL | Scraped page content (About, Products, etc.) |
| 3 | LLM (OpenAI) | Scraped text + financial KPIs | AI profile (strategic fit, defensibility, playbook, etc.) |
| 4 | Worker | Profile + analysis | Writes to `ai_profiles` and/or `company_enrichment` |

**Enrichment kinds stored:**
- `llm_analysis` – main AI analysis from enrichment worker
- `company_profile`, `website_insights`, `about_summary` – optional (worker currently produces `llm_analysis`)
- `ai_report` – generated on-demand from AI report service (cache-first)

---

## 3. Database Schema (Canonical)

**Primary tables in `nivo_optimized.db` (SQLite) or Postgres:**

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `companies` | Master company data | orgnr (PK), company_name, homepage, segment_names, nace_codes, employees_latest |
| `financials` | Historical P&L + balance sheet | orgnr, year, period, si_sek, sdi_sek, dr_sek, ebitda_sek, ebit_sek, account_codes (JSONB) |
| `company_kpis` | Derived metrics | orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, company_size_bucket, growth_bucket, profitability_bucket |

### Intelligence / Enrichment Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `ai_profiles` | AI-generated company profiles (one per company) | org_number, website, product_description, strategic_fit_score, defensibility_score, industry_sector, strategic_playbook, next_steps, risk_flags, scraped_pages |
| `enrichment_runs` | Run metadata | id, source, model, provider, meta (JSONB) |
| `company_enrichment` | Per-company enrichment by kind | orgnr, run_id, kind, result (JSONB), score |

### Supporting Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `saved_company_lists` | User-created lists | id, name, companies (JSONB), filters |
| `acquisition_runs` | Multi-stage acquisition workflow | id, criteria, stage, status, stage1/2/3 counts |
| `company_research` | Stage 2 research output | orgnr, homepage_url, website_content, scrape_success |
| `company_analysis` | Stage 3 AI analysis | orgnr, run_id, business_model, strategic_fit_score, recommendation |

### ER Overview

```
companies (1) ──────┬───────────── (N) financials
                    ├───────────── (1) company_kpis
                    ├───────────── (1) ai_profiles
                    ├───────────── (N) company_enrichment ─── (N) enrichment_runs
                    └───────────── (N) saved_company_lists (via JSONB companies)
```

---

## 4. Backend API Endpoints

### Company Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies/{orgnr}/intel` | Company intelligence (ai_profiles + company_enrichment artifacts) |
| GET | `/api/companies/{orgnr}/ai-report` | AI report (cache-first, or generate) |
| GET | `/api/companies/{orgnr}/financials` | Historical financials |
| POST | `/api/companies/batch` | Batch fetch companies with optional `include_ai` |

### AI Filtering & Search
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai-filter/` | Natural language → SQL filter → company list |
| GET | `/api/filters/analytics` | Filter analytics (percentiles, clusters) |
| POST | `/api/filters/apply` | Apply financial filters with weights |

### Enrichment
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/enrichment/run` | Start batch enrichment (enqueues to RQ, returns run_id + job_id) |
| GET | `/api/enrichment/run/{run_id}/status` | Enrichment progress |
| POST | `/api/enrichment/start` | Sync enrichment (legacy) |
| POST | `/api/companies/{orgnr}/enrich` | Single-company enrichment trigger |

### AI Reports
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai-reports/generate` | Generate/cache AI report for one company |
| POST | `/api/ai-reports/generate-batch` | Batch generate reports |

### Jobs (RQ)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/jobs/enrich` | Enqueue enrichment job |
| GET | `/api/jobs/{job_id}` | Job status |
| GET | `/api/jobs/` | List recent jobs |

### Other
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/status` | Health + DB counts + Redis |
| GET | `/api/status/config` | Effective config (no secrets) |
| GET/POST/DELETE | `/api/saved-lists` | Saved company lists |
| POST | `/api/export/copper` | Export to Copper CRM |
| POST | `/api/chat/` | Chat refine (AI) |
| POST | `/api/analysis/start` | Start analysis workflow |
| GET | `/api/analysis/runs/{run_id}` | Workflow run status |

---

## 5. Frontend Pages & Components (Backend App)

**Routes (all behind auth):**

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | AISourcingDashboard | Main app: AI chat filter → company list → export |
| `/companies/:orgnr` | CompanyDetail | Single company: financials, AI insights, deep dive |
| `/admin` | Admin | User management (approve/reject, roles) |
| `/valuation` | Valuation | Multi-model valuation calculator |
| `/analysis` | AnalysisPage | Analysis workflow runs |
| `/auth` | Auth | Login (Supabase or bypassed locally) |

### AISourcingDashboard (Main Entry)

- **AIChatFilter** – Natural language prompt → backend `/api/ai-filter/`
- **CompanyExplorer** – Table of companies from filter result; columns: revenue, profit, growth, etc.
- **Saved lists** – Load/save company selections
- **Export** – Export selected to Copper CRM
- **Enrichment** – Trigger enrichment for selected companies

### WorkingDashboard (Alternative / Legacy Layout)

Sidebar with tabs:
- Översikt (overview)
- Financial Filters
- Företagssökning (company search)
- Segmentering
- Analys
- AI-insikter
- Analyser
- Värdering
- Exportera
- Admin (if admin)

### CompanyDetail

- Financial charts
- AI insights (from ai_profiles / company_enrichment)
- **AIDeepDivePanel** – AI report (generate or load cached)
- Add to lists, export

---

## 6. Scraping Workflow (Detailed)

```
1. Scraper (Node/TypeScript)
   ├── getAllabolagSession() → cookies, CSRF token
   ├── fetchSearchPage() / bransch-sok → company list (companyId, orgnr)
   └── fetchFinancialData() → companyAccounts (year, period, accounts[])

2. Staging DB (scraper output)
   ├── company_accounts_by_id – raw accounts per company-year
   └── master_analytics – flattened company + latest metrics

3. Python Scripts (scripts/)
   ├── create_optimized_db.py
   │   └── companies, financials (from staging)
   └── create_kpi_table.py
       └── company_kpis (CAGR, margins, buckets)
```

**Account code mapping (examples):**
- SDI / SI → Revenue
- DR → Net profit
- ORS / EBITDA → EBITDA
- EK → Equity
- FK → Debt

---

## 7. Enrichment Workflow (Detailed)

```
1. Trigger: POST /api/enrichment/run { orgnrs, list_id?, kinds? }
   └── Creates enrichment_runs row, enqueues to RQ

2. RQ Worker: enrich_companies_batch(orgnrs, run_id, kinds)

   For each orgnr:
   a) Check ai_profiles / companies.homepage for existing website
   b) If no website: SerpAPI.lookup_website(company_name)
      └── Save to companies.homepage
   c) Puppeteer.scrape_multiple_pages(website) → scraped_pages
   d) AIAnalyzer.analyze(company_name, website, raw_text, scraped_pages, financial_metrics)
      └── LLM call → product_description, strategic_fit_score, defensibility_score, etc.
   e) Write to ai_profiles (and optionally company_enrichment with kind=llm_analysis)
```

---

## 8. Key UX Pain Points & Opportunities

1. **Dual entry points** – AISourcingDashboard (AI chat) vs WorkingDashboard (sidebar). Unclear which is primary.
2. **Scraping is offline** – No in-app trigger for scrape; users rely on pre-populated DB.
3. **Enrichment is async** – Jobs run in background; status polled via `/run/{id}/status`. UX for “enrichment in progress” could be improved.
4. **Data sources vary** – Supabase vs local SQLite; some features (saved lists) expect Supabase. Local mode bypasses auth.
5. **Fragmented navigation** – Valuation, Analysis, Admin are separate routes; could be unified in dashboard.
6. **AI report vs enrichment** – Two concepts: `ai_profiles` (full enrichment) vs `ai_report` (lighter, on-demand). UX could clarify when each is used.

---

## 9. File Reference (Critical Paths)

| Area | Path |
|------|------|
| Backend API | `backend/api/*.py` |
| Enrichment worker | `backend/workers/enrichment_worker.py` |
| DB services | `backend/services/local_db_service.py`, `db_factory.py` |
| Scraper | `scraper/allabolag-scraper/` |
| Create optimized DB | `scripts/create_optimized_db.py` |
| Create KPIs | `scripts/create_kpi_table.py` |
| Main dashboard | `frontend/src/pages/AISourcingDashboard.tsx` |
| Working dashboard | `frontend/src/pages/WorkingDashboard.tsx` |
| Company detail | `frontend/src/pages/CompanyDetail.tsx` |
| AI deep dive | `frontend/src/components/AIDeepDivePanel.tsx` |
| Schema | `database/local_postgres_schema.sql` |

---

*End of schematic. Use this to propose a reorganized backend UX workflow.*
