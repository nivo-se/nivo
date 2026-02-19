# Deployment Go Gate (2026-02-19)

## Scope
- Branch audited: `supabase-prepare`
- Goal: determine merge/deploy readiness and identify hard blockers for production release.

## Gate Summary
- Codebase readiness (repo): **GO**
- Infrastructure cutover readiness (Vercel + Railway + Supabase): **GO with required env/reset steps below**

## Verified Checks

### 1) Secrets / repo hygiene
- `git ls-files .env.vercel` returns empty (file not tracked).
- `.env.vercel` is ignored in `.gitignore`.
- Result: **PASS**

### 2) Backend runtime source of truth
- `backend/services/db_factory.py` defaults to `DATABASE_SOURCE=postgres`.
- API guards now default to postgres in backend API modules (no `DATABASE_SOURCE` defaulting to `local` in `backend/api`).
- Result: **PASS**

### 3) SQLite runtime involvement
- Runtime app path is Postgres-based (backend DB factory + `/api/status` + `/api/db/info` report postgres).
- Legacy SQLite files/scripts still exist for migration/audit tooling.
- Result: **PASS for runtime**, **NOT REMOVED from repo** (intentional for now).

### 4) Frontend API wiring
- Removed hard fallback usage of `http://localhost:8000` in active frontend API services.
- Shared base URL is centralized via `frontend/src/lib/apiClient.ts`.
- Result: **PASS**

### 5) Build/type/smoke
- Typecheck: `node ../node_modules/typescript/bin/tsc --noEmit` (from `frontend`) -> PASS
- Build: `node ../node_modules/vite/bin/vite.js build` (from `frontend`) -> PASS
- API smoke: `./scripts/smoke_api_endpoints.sh` -> PASS
- Frontend contract smoke: `backend/.venv/bin/python scripts/smoke_frontend_services.py` -> PASS
- Financials smoke: `./scripts/smoke_financials_endpoint.sh` -> PASS

Notes:
- In this local environment, `npm run build`/`npx tsc` rely on missing `.bin` shims, so direct binary invocation was used.
- Lint remains non-blocking in nightly checks due local dependency/tooling state.

## Database Size / Current State (local Postgres)
- Database: `nivo`
- Total size: **130 MB**
- Core row counts:
  - `companies`: 13,610
  - `financials`: 66,130
  - `company_kpis`: 13,610
  - `ai_profiles`: 90
  - `saved_lists`: 1
  - `saved_list_items`: 3
  - `prospects`: 3

## Deployment Architecture Decision
- Vercel in this repo is frontend/static build deployment.
- Backend API should run separately (Railway config exists in `backend/railway.json` + `backend/Procfile`).
- Therefore Railway (or equivalent backend host) is still required unless you redesign to full serverless API on Vercel.

## Required External Steps Before Production Push
1. Vercel env:
   - `VITE_API_BASE_URL=https://<your-railway-api-domain>`
2. Railway env:
   - `DATABASE_SOURCE=postgres`
   - `DATABASE_URL=<supabase-postgres-connection-string>` (or `SUPABASE_DB_URL`)
   - `REQUIRE_AUTH=true` (recommended for prod)
   - `CORS_ORIGINS=https://<your-vercel-domain>`
3. Supabase reset + load:
   - Reset DB
   - Apply schema/migrations (`database/local_postgres_schema.sql` + migrations)
   - Import canonical dataset (Postgres source preferred; SQLite only as one-time migration input if needed)
4. Post-deploy smoke:
   - `./scripts/smoke_api_endpoints.sh` against Railway URL
   - `backend/.venv/bin/python scripts/smoke_frontend_services.py` against Railway URL

## Go/No-Go
- **GO** to merge branch and deploy **after** setting production env vars and completing Supabase reset/import.
- No code-level blocker remains for Postgres-only runtime.
