# Nivo

**Nivo - backing great companies.** This monorepo powers our internal sourcing, analysis, and investment operations: a **Vite + React** SPA, **FastAPI** API, and **Postgres** as the source of truth. It covers company and financial data, multi-model valuation, AI-assisted research and screening, lists and pipeline views, and CRM-style workflows—built so analysis stays traceable to sources and the database schema evolves through migrations in `database/`.

## 🏗️ Project Structure

```
nivo/
├── 📁 backend/              # FastAPI (Python) API and workers
│   ├── api/                # API endpoints
│   ├── services/           # DB (Postgres), RAG, etc.
│   ├── requirements.txt   # Python dependencies
│   └── .env                # Environment variables (not in git)
├── 📁 frontend/            # Vite + React + TypeScript
│   ├── src/components/    # React components
│   ├── src/pages/         # Routes
│   ├── src/lib/            # API client, Supabase config
│   └── package.json        # Node.js dependencies
├── 📁 database/            # Schema and migrations (Postgres)
│   ├── migrations/         # SQL migrations
│   └── *.json              # Account code mapping, etc.
├── 📁 scripts/             # Bootstrap, smoke tests, migrations
└── .env.example            # Env template (copy to .env)
```

## Unified Nav v1 (feature flags)

Phase-1 navigation is the **default** product shell (segmented sidebar: Daily workstreams, Research, CRM). Optional overrides in `frontend/.env.local` (or root `.env` if you load the same keys into Vite):

| Variable | Effect |
|----------|--------|
| `VITE_NAV_UNIFIED_V1=false` | Use the **legacy** sidebar (Dashboard, Universe, Prospects, My Lists, CRM, AI Lab) instead of unified nav. Omit or leave empty for unified (default). |
| `VITE_HIDE_IN_DEVELOPMENT=true` | Hides the **In development** sidebar section (screening / deep research preview links). |
| `VITE_HIDE_LEGACY_SURFACES=true` | On **legacy** nav only: hides **Prospects** and **GPT target universe** from the sidebar. |

**Route aliases** (always registered; bookmarks work regardless of flags): `/today` → `/`, `/companies` → `/universe`, `/pipeline` → `/crm`, `/inbox` → `/crm?tab=inbox`, `/research` → `/ai`, and `/research/*` → `/ai/*`.

**Rollback:** set `VITE_NAV_UNIFIED_V1=false` (and optionally turn off the other two flags). No code deploy required beyond env.

Implementation: [`frontend/src/lib/featureFlags.ts`](frontend/src/lib/featureFlags.ts), [`frontend/src/pages/default/AppLayout.tsx`](frontend/src/pages/default/AppLayout.tsx), [`frontend/src/App.tsx`](frontend/src/App.tsx).

## Dev API: laptop/iMac + Mac mini on LAN

- **Mac mini (server):** configure **repo root `.env`** only (`DATABASE_*`, `OPENAI_API_KEY`, etc.) and run the API there. No need to duplicate that in the laptop’s frontend env.
- **Laptop / iMac:** in **`frontend/.env.local`** (gitignored), set **`VITE_DEV_API_PROXY_TARGET=http://<mini-ip>:8000`**. Leave **`VITE_API_BASE_URL` unset** so the browser uses same-origin `/api` and Vite proxies to the mini (avoids CORS churn and no URL flipping when you move between machines).
- **Same machine as API:** omit `VITE_DEV_API_PROXY_TARGET` or set it to `http://127.0.0.1:8000`.
- **Production (Vercel, etc.):** set **`VITE_API_BASE_URL`** to the public API; there is no Vite proxy.

Details: [`frontend/.env.example`](frontend/.env.example), [`frontend/vite.config.ts`](frontend/vite.config.ts).

## 📚 Documentation

**Full doc index:** [docs/README.md](docs/README.md) — setup, data source of truth, API, smoke tests, and production checklists.

Key docs:

- **Fresh Mac setup:** [docs/FRESH_MAC_SETUP.md](docs/FRESH_MAC_SETUP.md) — one-command setup for new machines
- **Local Postgres:** [docs/LOCAL_POSTGRES_SETUP.md](docs/LOCAL_POSTGRES_SETUP.md), [docs/LOCAL_POSTGRES_BOOTSTRAP.md](docs/LOCAL_POSTGRES_BOOTSTRAP.md)
- **Deploy (Mac Mini):** [docs/DEPLOY_MAC_MINI.md](docs/DEPLOY_MAC_MINI.md)
- **Financials (source of truth):** [docs/FINANCIALS_SOURCE_OF_TRUTH.md](docs/FINANCIALS_SOURCE_OF_TRUTH.md)
- **Smoke tests:** [docs/SMOKE_TEST_PLAYBOOK.md](docs/SMOKE_TEST_PLAYBOOK.md)
- **Production:** [docs/PRODUCTION_ENV_CHECKLIST.md](docs/PRODUCTION_ENV_CHECKLIST.md)

## 🚀 Features

### 🤖 AI-Powered Analysis
- **GPT-4 Integration**: Advanced AI insights using GPT-4.1-mini and GPT-4o
- **Swedish Localization**: All AI responses in Swedish with proper business terminology
- **Multi-Model Analysis**: Revenue, EBITDA, Earnings, and DCF valuation models
- **Intelligent Commentary**: Automated company summaries, risk assessment, and opportunities
- **Historical Analysis**: Track analysis runs and compare results over time

### 💰 Advanced Valuation Engine
- **Multi-Model Valuation**: Revenue Multiple, EBITDA Multiple, Earnings Multiple, DCF-Lite, Hybrid Score-Adjusted
- **Industry-Specific Assumptions**: Tailored valuation multiples for different industries
- **Real-Time Calculations**: Live valuation updates with proper financial conversions
- **Export Capabilities**: CSV, Excel, and PDF export functionality
- **Interactive Charts**: Revenue trends, EV/EBITDA comparisons, and financial metrics

### 📋 Saved Company Lists
- **Complete CRUD Operations**: Create, read, update, and delete company lists
- **Advanced Search Integration**: Add companies from search results to lists
- **List Management**: Organize companies into custom categories
- **Persistent Storage**: Supabase integration with proper security policies
- **User-Friendly Interface**: Intuitive list management with easy company removal

### 🎨 Modern Frontend (Vite/React/TypeScript)
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Advanced Search**: Multi-criteria filtering with MSEK format display
- **Interactive Dashboard**: Real-time analytics with corrected financial calculations
- **Export Features**: Multiple format support (CSV, Excel, PDF)
- **Accessibility**: WCAG-compliant components and navigation

### 🛠️ Backend (FastAPI + Python)
- **API**: Company data, AI filter, enrichment, lists, labels, prospects, export
- **Database**: Postgres (local Docker or Mac Mini); see [docs/LOCAL_POSTGRES_SETUP.md](docs/LOCAL_POSTGRES_SETUP.md)
- **AI**: OpenAI for filtering, analysis, and reports
- **Workers**: RQ + Redis for enrichment and background jobs

### 🗄️ Database (Postgres)
- **Runtime**: Postgres only (`DATABASE_SOURCE=postgres`). Schema and migrations in `database/`.
- **Tables**: companies, financials, company_kpis, company_enrichment, saved_lists, saved_list_items, company_labels, etc.
- **Auth**: Supabase Auth for frontend; app data in your Postgres instance.

## 📊 Data Overview

- **Companies**: 8,479+ Swedish companies with comprehensive financial data
- **Financial Data**: 35,409+ financial records with corrected MSEK conversions
- **Valuation Models**: 5 different valuation approaches with industry-specific assumptions
- **AI Analysis**: GPT-4 powered insights with Swedish localization
- **Saved Lists**: Complete company list management with CRUD operations
- **Export Formats**: CSV, Excel, and PDF export capabilities

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- Docker (for local Postgres)
- Redis (for background jobs)
- Supabase account (auth)
- OpenAI API key

### Full-Stack Setup
```bash
# Clone the repository
git clone [repository-url]
cd nivo

# Start Postgres (Docker)
docker compose -f docker-compose.postgres.yml up -d
# Then: scripts/bootstrap_postgres_schema.py, scripts/run_postgres_migrations.sh

# Configure environment
cp .env.example .env
# Set DATABASE_SOURCE=postgres, POSTGRES_*, OPENAI_API_KEY, SUPABASE_*, REDIS_URL

# Backend (from repo root)
python -m uvicorn backend.api.main:app --reload --port 8000

# Frontend (from repo root)
npm install && npm run dev
```

See [docs/LOCAL_POSTGRES_SETUP.md](docs/LOCAL_POSTGRES_SETUP.md) and [docs/LOCAL_POSTGRES_BOOTSTRAP.md](docs/LOCAL_POSTGRES_BOOTSTRAP.md) for Postgres. See [QUICK_START.md](QUICK_START.md) for a quick server reference.

### Mac Mini (production)

Backend and Postgres run on the Mac Mini. See [docs/DEPLOY_MAC_MINI.md](docs/DEPLOY_MAC_MINI.md). Set `VITE_API_BASE_URL` in Vercel to your Mac Mini API URL.

## 🚀 Deployment

**Production env checklist:** [docs/PRODUCTION_ENV_CHECKLIST.md](docs/PRODUCTION_ENV_CHECKLIST.md). Verify with `GET /api/status/config` after deploy.

- **Frontend:** Vercel. Set `VITE_API_BASE_URL` to your Mac Mini API URL, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Backend + Postgres:** Mac Mini. See [docs/DEPLOY_MAC_MINI.md](docs/DEPLOY_MAC_MINI.md) and [VERCEL_RAILWAY_SETUP.md](VERCEL_RAILWAY_SETUP.md) (Vercel + Mac Mini).

## 📈 Usage

### Web Interface
- **Company Search**: Advanced search with multi-criteria filtering
- **Valuation Analysis**: Multi-model valuation with AI insights
- **Saved Lists**: Create and manage company lists
- **Dashboard**: Real-time analytics and financial metrics
- **Export**: Download data in CSV, Excel, or PDF formats

### API Endpoints
- `GET /api/companies` - Company search and filtering
- `POST /api/valuation` - Multi-model valuation calculations
- `GET /api/saved-lists` - Saved company lists management
- `POST /api/ai-analysis` - AI-powered company insights

## 🔧 Configuration

### Environment Variables

#### Required
- **Frontend:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Backend:** `DATABASE_SOURCE=postgres`, `POSTGRES_*` (or `SUPABASE_DB_URL`), `OPENAI_API_KEY`, `SUPABASE_*`, `REDIS_URL`

See [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) and [.env.example](.env.example).

## 📊 Key Tables (Postgres)

- `companies`, `financials`, `company_kpis`: Core company and financial data
- `company_enrichment`: AI and scraped enrichment (per kind)
- `saved_lists`, `saved_list_items`: Saved company lists
- `company_labels`: User/app labels
- See [docs/FINANCIALS_SOURCE_OF_TRUTH.md](docs/FINANCIALS_SOURCE_OF_TRUTH.md) and `database/` for schema details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational and research purposes.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Built with React, TypeScript, Vite, FastAPI, Postgres, and OpenAI**

## Production

The app is deployed with the SPA on Vercel and the API plus Postgres on our own host (see [docs/DEPLOY_MAC_MINI.md](docs/DEPLOY_MAC_MINI.md)). Use [docs/PRODUCTION_ENV_CHECKLIST.md](docs/PRODUCTION_ENV_CHECKLIST.md) and `GET /api/status/config` after changes.
