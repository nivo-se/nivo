# Nightly Code Check Report
Date: 2026-02-19
Scope: full repo health sweep (frontend, backend, API contracts, guardrails, CI drift, dead-code signals)

## Executed checks
- `cd frontend && npm run lint`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run build`
- `./scripts/no_figma_naming.sh`
- `./scripts/no_compat_imports.sh`
- `./scripts/smoke_api_endpoints.sh`
- `backend/.venv/bin/python scripts/smoke_frontend_services.py`
- `./scripts/smoke_financials_endpoint.sh`
- static scans with `rg` for localhost endpoints, TODO markers, and legacy references

## Result summary
- Pass:
  - Frontend typecheck
  - Frontend production build
  - API endpoint smoke
  - Frontend service contract smoke
  - Naming guardrails (`no_figma_naming`, `no_compat_imports`)
  - Financials endpoint smoke
- Fail:
  - Frontend lint (tooling crash, not a code-style violation)

## Findings (ordered by severity)

### 1) Lint pipeline is broken (blocks CI quality gate)
- Evidence:
  - `frontend/package.json:11` defines `"lint": "eslint ."`
  - `frontend/package.json:95-99` and `package.json:28-31` force dependency overrides including `ajv` and `path-to-regexp`
  - Runtime failure from `npm run lint`: `TypeError: Cannot set properties of undefined (setting 'defaultMeta')` from `@eslint/eslintrc`
- Impact:
  - Lint cannot run locally or in CI, so regressions slip through.
- Recommendation:
  - Pin a compatible ESLint/ajv stack or remove conflicting root/frontend overrides and regenerate lockfile in a clean install.

### 2) CI workflow references missing script and outdated stack assumptions
- Evidence:
  - `.github/workflows/dashboard-api-tests.yml:66` runs `python3 scripts/create_test_local_db.py`
  - `scripts/create_test_local_db.py` is missing in repo
  - Same workflow boots `frontend/server/enhanced-server.ts` and old dashboard API path assumptions (`.github/workflows/dashboard-api-tests.yml:68-86`)
- Impact:
  - CI job is likely broken or not representative of current Postgres/FastAPI architecture.
- Recommendation:
  - Replace workflow with canonical checks: `frontend build/typecheck`, `scripts/smoke_api_endpoints.sh`, `scripts/smoke_frontend_services.py`.

### 3) Environment template drift vs actual backend behavior
- Evidence:
  - `.env.example:20` sets `DATABASE_SOURCE=local`
  - `backend/services/db_factory.py:30-37` explicitly rejects `local` SQLite mode and requires Postgres
- Impact:
  - New environment setups can fail immediately.
- Recommendation:
  - Update `.env.example` default to `DATABASE_SOURCE=postgres` and remove/mark legacy SQLite guidance.

### 4) Hardcoded localhost API calls in UI components (cloud break risk)
- Evidence:
  - `frontend/src/components/SessionTrackingDashboard.tsx:153,186,207,357,391,497` uses `http://localhost:3000/...`
  - `frontend/src/components/DataValidationView.tsx:98` uses `http://localhost:3000/...`
  - `frontend/src/components/ScraperStatusDashboard.tsx:230,279,285` hardcodes localhost links
  - `frontend/src/components/ScraperInterface.tsx:20` opens `http://localhost:3000`
- Impact:
  - These features will fail in production unless the same host/port topology exists.
- Recommendation:
  - Route all calls through `VITE_API_BASE_URL` or relative `/api/*` proxy paths.

### 5) High volume of macOS AppleDouble sidecar files in source tree (`._*`)
- Evidence:
  - `find backend frontend scripts docs database -name '._*'` reports many files (including source dirs, not only virtualenv/node_modules)
  - Examples include `frontend/src/...` and `backend/api/...` siblings.
- Impact:
  - Tooling noise, false compile/lint failures, accidental packaging bloat.
- Recommendation:
  - Add cleanup step and git guardrail to block committing `._*` files.

### 6) Dead/legacy page candidates (not routed in current app)
- Evidence:
  - No route imports for:
    - `frontend/src/pages/AnalysisPage.tsx`
    - `frontend/src/pages/AISourcingDashboard.tsx`
    - `frontend/src/pages/Admin.tsx`
  - Legacy pages still reachable only via `/old/*` routes in `frontend/src/App.tsx:88-95`.
- Impact:
  - Maintenance drag and confusion over authoritative UI.
- Recommendation:
  - Tag these as `legacy` or remove after route-level decision.

## Smoke verification notes
- `scripts/smoke_api_endpoints.sh`:
  - PASS (health/status/capabilities/db-info/universe/lists/prospects/analysis all 200)
  - `database_source` confirmed as `postgres`
- `scripts/smoke_frontend_services.py`:
  - PASS for universe/companies/lists/prospects/analysis and list `sourceViewId` update contract
- `scripts/smoke_financials_endpoint.sh`:
  - PASS
  - Note: script currently ignores CLI orgnr arg; it only reads `SMOKE_FINANCIALS_ORGNR` env.

## Added automation
- New script: `scripts/nightly_code_check.sh`
  - Runs guardrails, typecheck, build, lint, API smoke, frontend-service smoke, financials smoke
  - Includes warning checks for `._*` artifacts and localhost:3000 API hardcoding
  - Exit code `2` when any hard check fails

## Recommended immediate fixes (next 24h)
1. Fix ESLint/AJV dependency conflict and restore `npm run lint`.
2. Repair/replace `.github/workflows/dashboard-api-tests.yml` to current architecture.
3. Update `.env.example` to Postgres defaults.
4. Remove/ignore `._*` artifacts from tracked source.
5. Replace hardcoded localhost URLs in scraper/session components.
