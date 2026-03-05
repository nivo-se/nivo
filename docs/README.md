# Nivo documentation index

Canonical docs for setup, data, API, and operations. One-off status or fix logs are not listed here.

## Setup and local development

| Doc | Purpose |
|-----|--------|
| [LOCAL_POSTGRES_SETUP.md](LOCAL_POSTGRES_SETUP.md) | Start Postgres with Docker (port 5433). |
| [LOCAL_POSTGRES_BOOTSTRAP.md](LOCAL_POSTGRES_BOOTSTRAP.md) | Apply schema: `scripts/bootstrap_postgres_schema.py`. |
| [LOCAL_DEV_MODE.md](LOCAL_DEV_MODE.md) | Local dev mode and auth bypass. |
| [../START_ALL_SERVERS.md](../START_ALL_SERVERS.md) | Start backend, frontend, Redis, RQ worker (quick reference). |
| [cursor-db.md](cursor-db.md) | Task memo: DB reset and production DB checklist (Mac Mini Postgres). |

## Deployment

| Doc | Purpose |
|-----|--------|
| [DEPLOY_MAC_MINI.md](DEPLOY_MAC_MINI.md) | Production deploy: Postgres + API on Mac Mini (Docker Compose). |

## Data and API

| Doc | Purpose |
|-----|--------|
| [FINANCIALS_SOURCE_OF_TRUTH.md](FINANCIALS_SOURCE_OF_TRUTH.md) | **Source of truth:** `financials` table. Core columns vs `account_codes`. Legacy `company_financials`. |
| [DATA_MAPPING_AUDIT.md](DATA_MAPPING_AUDIT.md) | Universe and Company Profile field mapping to DB. |
| [API_NAMING_CONVENTIONS.md](API_NAMING_CONVENTIONS.md) | API and frontend naming conventions. |
| [API_CONTRACT.md](API_CONTRACT.md) | API contract and capabilities. |
| [AI_ENDPOINTS_FRONTEND.md](AI_ENDPOINTS_FRONTEND.md) | AI/analysis endpoints used by the frontend. |
| [AI_ANALYSIS_WORKFLOW.md](AI_ANALYSIS_WORKFLOW.md) | AI analysis (screening/deep) flow and production setup. |
| [ENRICHMENT_KINDS.md](ENRICHMENT_KINDS.md) | Canonical `company_enrichment.kind` values. |

## Testing and operations

| Doc | Purpose |
|-----|--------|
| [CONNECTIONS_VERIFICATION.md](CONNECTIONS_VERIFICATION.md) | **DB, Auth, Vercel, Mac Mini:** Verify Postgres, auth, and deployment connections. |
| [SMOKE_TEST_PLAYBOOK.md](SMOKE_TEST_PLAYBOOK.md) | **Canonical:** Script-based smoke tests (API, frontend, financials, audit). Run before deploy. |
| [PROD_SMOKE_TEST.md](PROD_SMOKE_TEST.md) | Manual production verification (routes and MVP gate). |
| [PRODUCTION_ENV_CHECKLIST.md](PRODUCTION_ENV_CHECKLIST.md) | Production env vars and config. |
| [DEPLOY_CHECKLIST_MVP.md](DEPLOY_CHECKLIST_MVP.md) | Deploy checklist. |

## Database and migrations

| Doc | Purpose |
|-----|--------|
| [POSTGRES_MIGRATION_VALIDATION.md](POSTGRES_MIGRATION_VALIDATION.md) | Postgres migration validation. |
| [POSTGRES_INTEGRITY_AUDIT.md](POSTGRES_INTEGRITY_AUDIT.md) | Read-only integrity audit (duplicates, orphans, KPI vs financials). |
| [SQLITE_TO_POSTGRES_COMPARISON.md](SQLITE_TO_POSTGRES_COMPARISON.md) | Schema parity: SQLite vs Postgres. |
| [SUPABASE_AUTH_SETUP.md](SUPABASE_AUTH_SETUP.md) | *(Deprecated)* Supabase Auth; project uses Postgres + JWT. |

## Design and legacy

| Doc | Purpose |
|-----|--------|
| [FIGMA_DESIGN_REFERENCE.md](FIGMA_DESIGN_REFERENCE.md) | Figma design export and UX reference (migration completed; default routes use backend API). |

## Architecture

| Doc | Purpose |
|-----|--------|
| [SCRAPER_VS_BACKEND.md](SCRAPER_VS_BACKEND.md) | **Scraper service** (admin-only, for adding companies) is separate; **backend** uses only DB data + direct URL fetch when we have a URL. |

## Other

- **database/** — Schema, migrations, [ACCOUNT_CODE_MAPPING_GUIDE.md](../database/ACCOUNT_CODE_MAPPING_GUIDE.md).
- [COLOR_SCHEME.md](COLOR_SCHEME.md) — Design color tokens (if using design system).
