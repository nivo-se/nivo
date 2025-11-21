# Nivo Project Status

**Last Updated:** 2024-11-20  
**Current Branch:** `feature-ai-chat`  
**Project Type:** Full-stack Swedish Company Intelligence Platform

---

## 🎯 Project Overview

Nivo is an AI-first sourcing tool for identifying and analyzing Swedish companies (SMEs) for acquisition targeting. The platform combines financial data scraping, AI-powered filtering, company enrichment, and CRM export capabilities.

**Key Features:**
- AI-driven company filtering using natural language prompts
- Financial data analysis with accurate KPI calculations
- Company enrichment with web scraping and AI analysis
- Export to Copper CRM
- Interactive dashboard with Explorer View and AI Insights

---

## 🏗️ Architecture

### **Frontend** (React + TypeScript + Vite)
- **Location:** `frontend/`
- **Framework:** React 18 with TypeScript
- **UI Library:** shadcn/ui components
- **Styling:** Tailwind CSS
- **State Management:** React Context (AuthContext)
- **Deployment:** Vercel

**Key Pages:**
- `/` - Landing page
- `/dashboard` - Main AI Sourcing Dashboard (`AISourcingDashboard.tsx`)
- `/company/:orgnr` - Company detail page (`CompanyDetail.tsx`)
- `/auth` - Authentication

**Key Components:**
- `AIChatFilter.tsx` - AI-powered company filtering interface
- `CompanyExplorer.tsx` - Table view of companies with financial metrics
- `AIInsights.tsx` - AI-generated company insights
- `ExportQueue.tsx` - Export selected companies to Copper CRM

### **Backend** (FastAPI + Python)
- **Location:** `backend/`
- **Framework:** FastAPI 0.115.0
- **Server:** Uvicorn
- **Deployment:** Railway
- **Port:** 8000 (local), Railway (production)

**Key API Endpoints:**

#### Company Data
- `GET /api/companies/{orgnr}/intel` - Get company intelligence data
- `GET /api/companies/{orgnr}/ai-report` - Get AI analysis report
- `POST /api/companies/batch` - Get multiple companies with KPIs
- `GET /api/companies/{orgnr}/financials` - Get historical financial data

#### AI Filtering
- `POST /api/ai-filter/` - Natural language company filtering
  - Accepts: `{ prompt: string, limit: int, offset: int }`
  - Returns: `{ sql: string, org_numbers: string[], count: int }`

#### Enrichment
- `POST /api/enrichment/start` - Start enrichment job for companies
- `GET /api/jobs/{job_id}` - Get job status

#### Export
- `POST /api/export/copper` - Export companies to Copper CRM

#### Status
- `GET /health` - API health check
- `GET /status` - Comprehensive service status (API, Supabase, Redis)

### **Database** (SQLite Local + Supabase Remote)

#### Local Database (`data/nivo_optimized.db`)
- **Type:** SQLite
- **Size:** ~36 MB
- **Companies:** 13,610
- **Structure:**
  - `companies` table - Company details (orgnr, name, address, employees, etc.)
  - `financials` table - Financial data (one row per company-year, 52+ account code columns)
  - `company_kpis` table - Pre-calculated KPIs (margins, growth, segmentation buckets)

**Key Account Codes (from Allabolag):**
- `SI` - Nettoomsättning (Net Sales) - **Primary revenue metric**
- `SDI` - Omsättning (Total Sales) - Revenue fallback
- `resultat_e_avskrivningar` - Rörelseresultat efter avskrivningar (EBIT) - **Primary EBIT metric**
- `ebitda_sek` - EBITDA (preferred)
- `ors_sek` - Rörelseresultat (Operating Result) - EBITDA fallback
- `DR` - Årets resultat (Net Profit)
- `RG` - **NOT EBIT** - This is working capital, do not use for EBIT!

**Important:** All financial values are stored in **actual SEK** (not thousands). The scraper multiplies by 1000 during extraction.

#### Supabase (Remote)
- **Purpose:** Authentication, AI queries logging, future data sync
- **Tables:** `auth.*`, `ai_queries`, `ai_profiles` (planned)
- **Status:** Cleaned up, minimal storage (~10 MB)

### **Services & Infrastructure**

#### Redis
- **Purpose:** Job queue for background tasks (enrichment, AI analysis)
- **Library:** RQ (Redis Queue)
- **Status:** Required for enrichment jobs

#### OpenAI
- **Purpose:** 
  - AI filtering (prompt-to-SQL conversion)
  - Company enrichment analysis
  - AI report generation
- **Model:** `gpt-4o-mini` (configurable via `OPENAI_MODEL`)

#### SerpAPI & Puppeteer
- **Purpose:** Web scraping for company enrichment
- **Status:** Prepared but not actively used yet

#### Copper CRM
- **Purpose:** Export identified target companies
- **Status:** API endpoint ready, requires `COPPER_API_TOKEN`

---

## 📁 Key File Structure

```
nivo/
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── AIChatFilter.tsx
│   │   │   ├── CompanyExplorer.tsx
│   │   │   ├── AIInsights.tsx
│   │   │   └── ExportQueue.tsx
│   │   ├── pages/
│   │   │   ├── AISourcingDashboard.tsx
│   │   │   └── CompanyDetail.tsx
│   │   └── lib/
│   │       └── apiService.ts    # API client
│   └── package.json
│
├── backend/                     # FastAPI backend
│   ├── api/                     # API endpoints
│   │   ├── main.py              # FastAPI app
│   │   ├── companies.py        # Company endpoints
│   │   ├── ai_filter.py         # AI filtering
│   │   ├── enrichment.py       # Enrichment jobs
│   │   └── export.py            # CRM export
│   ├── services/                # Database abstraction
│   │   ├── db_factory.py        # Database service factory
│   │   ├── local_db_service.py  # SQLite implementation
│   │   └── supabase_db_service.py  # Supabase implementation
│   ├── workers/                 # Background workers
│   │   ├── enrichment_worker.py
│   │   └── ai_analyzer.py
│   └── requirements.txt
│
├── data/
│   └── nivo_optimized.db        # Local SQLite database
│
├── database/
│   ├── allabolag_account_code_mapping.json  # Account code reference
│   └── ACCOUNT_CODE_MAPPING_GUIDE.md        # Usage guide
│
├── scripts/
│   ├── create_optimized_db.py   # Database creation script
│   └── create_kpi_table.py      # KPI calculation script
│
└── .env                         # Environment variables (not in git)
```

---

## 🔑 Environment Variables

**Required for Backend:**
```bash
# Database
DATABASE_SOURCE=local              # 'local' or 'supabase'
LOCAL_DB_PATH=data/nivo_optimized.db

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Supabase (for auth and logging)
SUPABASE_URL=https://...
SUPABASE_KEY=...

# Redis (for job queues)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:8080,https://your-vercel-app.vercel.app

# Optional
SERPAPI_KEY=...                    # For web scraping enrichment
COPPER_API_TOKEN=...              # For CRM export
```

**Required for Frontend:**
```bash
VITE_API_BASE_URL=http://localhost:8000  # Backend API URL
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

---

## 🗄️ Database Schema

### `companies` Table
```sql
orgnr TEXT PRIMARY KEY
company_id TEXT NOT NULL
company_name TEXT NOT NULL
homepage TEXT
foundation_year INTEGER
employees_latest INTEGER
nace_categories TEXT  -- JSON string
segment_names TEXT    -- JSON string
address TEXT
city TEXT
zip_code TEXT
country TEXT
```

### `financials` Table
```sql
id TEXT PRIMARY KEY
orgnr TEXT NOT NULL
company_id TEXT NOT NULL
year INTEGER NOT NULL
period TEXT NOT NULL
currency TEXT
employees INTEGER
si_sek REAL          -- Nettoomsättning (Net Sales)
sdi_sek REAL          -- Omsättning (Total Sales)
ebitda_sek REAL       -- EBITDA
ors_sek REAL          -- Rörelseresultat (Operating Result)
resultat_e_avskrivningar_sek REAL  -- EBIT
dr_sek REAL           -- Årets resultat (Net Profit)
... (50+ more account code columns)
UNIQUE(orgnr, year, period)
```

### `company_kpis` Table
```sql
orgnr TEXT PRIMARY KEY
latest_revenue_sek REAL
latest_profit_sek REAL
latest_ebitda_sek REAL
avg_ebitda_margin REAL        -- Weighted average: total EBITDA / total revenue
avg_net_margin REAL
revenue_cagr_3y REAL          -- 3-year CAGR (as decimal, e.g., 0.15 = 15%)
revenue_growth_yoy REAL       -- Year-over-year growth (as decimal)
company_size_bucket TEXT      -- 'small', 'medium', 'large'
growth_bucket TEXT            -- 'declining', 'flat', 'moderate', 'high'
profitability_bucket TEXT     -- 'loss-making', 'low', 'healthy', 'high'
```

---

## 🔧 Key Scripts

### Database Management
- `scripts/create_optimized_db.py` - Create optimized database from scraper staging data
  - Usage: `python3 scripts/create_optimized_db.py --source staging/staging_current.db --output data/nivo_optimized.db`
- `scripts/create_kpi_table.py` - Calculate and populate KPIs
  - Usage: `python3 scripts/create_kpi_table.py --db data/nivo_optimized.db`

### Development
- `npm run dev` - Start frontend dev server (port 8080)
- `python3 -m uvicorn backend.api.main:app --port 8000` - Start backend API
- `rq worker` - Start Redis worker for background jobs

---

## 📊 Current Data Status

- **Total Companies:** 13,610
- **Companies with Revenue Data:** 10,176 (74.8%)
- **Companies with EBITDA Margins:** 10,148 (99.7% of those with revenue)
- **Database Size:** ~36 MB
- **Financial Years:** 2020-2024 (5 years)
- **Account Codes Extracted:** 52+ codes

---

## 🐛 Recent Fixes

### Account Code Mapping (2024-11-20)
- **Issue:** Revenue and EBIT values didn't match Allabolag
- **Fix:** 
  - Use `SI` (Nettoomsättning) for revenue instead of `SDI`
  - Use `resultat_e_avskrivningar` for EBIT instead of `RG`
  - Created comprehensive account code mapping documentation

### EBITDA Margin Calculation (2024-11-20)
- **Issue:** Many companies showed N/A or incorrect negative margins
- **Fix:** Changed from simple average to weighted average (total EBITDA / total revenue)
- **Result:** 99.7% of companies with revenue now have accurate margins

### Currency Units (2024-11-20)
- **Issue:** Financial values stored as thousands instead of actual SEK
- **Fix:** Database extraction now multiplies by 1000 during migration
- **Result:** All values now in actual SEK

---

## 🚀 Deployment

### Frontend (Vercel)
- **Branch:** `main` (auto-deploys)
- **Build Command:** `cd frontend && npm run build`
- **Output Directory:** `frontend/dist`

### Backend (Railway)
- **Branch:** `feature-ai-chat` (or `main`)
- **Build Command:** Auto-detected (Nixpacks)
- **Start Command:** `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables:** Set in Railway dashboard

---

## 📝 Important Notes

1. **Database Abstraction:** The backend uses a factory pattern (`db_factory.py`) to support both local SQLite and Supabase. Currently using local database.

2. **Account Codes:** Always refer to `database/allabolag_account_code_mapping.json` for correct account code usage. Critical: `RG` is NOT EBIT - it's working capital.

3. **Financial Units:** All values in database are in **actual SEK**, not thousands. Frontend displays in millions (mSEK) for readability.

4. **KPI Calculations:**
   - Margins use weighted average (total metric / total revenue)
   - Growth rates are calculated as percentages (e.g., 0.15 = 15%)
   - CAGR uses compound annual growth formula

5. **AI Filter:** The AI filter converts natural language prompts to SQL WHERE clauses. It queries the `financials` table directly for accurate revenue filtering.

6. **Session Storage:** Search results are stored in browser session storage for persistence during the session.

---

## 🔮 Future Plans

- Migrate local database to Supabase for production
- Implement full enrichment pipeline (SerpAPI + Puppeteer)
- Add more AI analysis features
- Expand CRM export capabilities
- Add more financial metrics and visualizations

---

## 📚 Documentation Files

- `database/ACCOUNT_CODE_MAPPING_GUIDE.md` - Account code usage guide
- `database/allabolag_account_code_mapping.json` - Complete account code reference
- `KPI_TABLE_GUIDE.md` - KPI calculation methods
- `OPTIMIZED_DATABASE_GUIDE.md` - Database structure details

---

**For Codex:** This status file provides a comprehensive overview of the Nivo project structure, architecture, database schema, API endpoints, and current state. Use this as context when generating prompts or code for the project.

