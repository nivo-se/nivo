# Smoke Test Playbook

This playbook verifies backend API readiness and frontend service contracts for the canonical domain services:

- Universe
- Companies
- Lists
- Prospects
- Analysis
- Status

## Environment setup

1. Start Postgres (Docker):
```bash
docker compose up -d
```

2. Ensure backend env is Postgres-backed:
```bash
export DATABASE_SOURCE=postgres
```

3. Start backend API (default ports in this repo are typically `8001` or `8000`):
```bash
./scripts/start_backend.sh
```

4. Optional: set explicit API base used by smoke scripts:
```bash
export VITE_API_BASE_URL=http://127.0.0.1:8001
```

## Script 1: API endpoint smoke (curl)

Runs endpoint-level checks and DB-source verification.

```bash
./scripts/smoke_api_endpoints.sh
```

Checks:

- `GET /health`
- `GET /api/status`
- `GET /api/status/capabilities`
- `GET /api/db/info`
- `POST /api/universe/query`
- `GET /api/lists?scope=all`
- `GET /api/prospects?scope=team`
- `GET /api/analysis/runs?limit=5`

Exit codes:

- `0`: all required endpoints returned `200` or `401`
- `2`: any endpoint returned `404/500`, timed out, or DB source check failed

## Script 2: frontend service contract smoke

Runs shape checks for payloads used by canonical frontend services.

```bash
python3 scripts/smoke_frontend_services.py
```

Checks:

- Universe query shape (`rows[]`, `total`)
- Companies batch shape (`companies[]`, `count`)
- Lists shape (`items[]`)
- Prospects shape (`items[]`)
- Analysis runs shape (`success`, `runs[]`)
- Auth-gated contract test for list updates:
  - create view
  - create list
  - `PUT /api/lists/{id}` with `sourceViewId`
  - verify `source_view_id` is returned

Exit codes:

- `0`: checks passed or were auth-gated (`AUTH REQUIRED`)
- `2`: shape mismatch, timeout/network failure, `404/500`, or sourceViewId contract failure

## Script 3: Financials endpoint smoke

Verifies `GET /api/companies/{orgnr}/financials` returns 200 and does not return Postgres "ambiguous column" errors.

```bash
./scripts/smoke_financials_endpoint.sh
```

Checks:

- Endpoint returns HTTP 200
- Response body does not contain "ambiguous"
- Optional (if jq available): `count` and first row shape

Exit codes:

- `0`: PASS
- `2`: non-200, timeout, or response contains "ambiguous"

See also: [docs/FINANCIALS_SOURCE_OF_TRUTH.md](FINANCIALS_SOURCE_OF_TRUTH.md).

## Script 4: Financial coverage audit (read-only)

Prints counts and samples for the `financials` table. Informational only; exit code always 0.

```bash
python scripts/audit_financial_coverage.py
```

Prints:

- Companies count
- Financials rows count
- Companies with >= 3 years financials
- Companies with non-empty `account_codes` (any year)
- Sample 20 orgnr with empty `account_codes`

Use this to quantify why balance sheet lines may be missing (empty `account_codes`). Requires Postgres connection (DATABASE_URL or POSTGRES_* env vars).

## What AUTH REQUIRED means

`AUTH REQUIRED` indicates the endpoint is protected in the current environment and returned `401`.

- This is an allowed smoke result.
- It means service wiring is likely intact, but the check cannot validate content without a valid session/token.

## Failure reporting template

When opening an issue, include:

1. Endpoint path and HTTP status
2. First 2000 chars of response body
3. Backend log excerpt around the failure timestamp
4. Output of:
   - `./scripts/smoke_api_endpoints.sh`
   - `python3 scripts/smoke_frontend_services.py`
5. Runtime env summary:
   - `DATABASE_SOURCE`
   - API base URL
   - auth mode (`REQUIRE_AUTH`)

## Pre-deploy checklist (cloud)

1. Backend healthy: `GET /health` and `GET /api/status`.
2. `database_source` is `postgres` via `/api/db/info`.
3. `./scripts/smoke_api_endpoints.sh` exits `0`.
4. `python3 scripts/smoke_frontend_services.py` exits `0`.
5. `./scripts/smoke_financials_endpoint.sh` exits `0` (financials endpoint no ambiguous error).
6. Optional: `python scripts/audit_financial_coverage.py` to inspect financials/account_codes coverage.
7. Auth flow validated in target environment (no accidental public/protected mismatch).
8. `sourceViewId` update contract validated in an authenticated run.
