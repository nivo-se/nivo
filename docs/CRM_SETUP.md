# Origination CRM – Setup and Trying the Features

The CRM layer lives in `frontend/server`: API routes under `/crm/*` and services in `frontend/server/services/crm/`. It uses **Postgres** (schema `deep_research`) for deals, contacts, emails, and interactions — the same database as the backend.

## 1. Is there a CRM frontend?

Yes. A minimal **CRM page** is available at **/crm** in the app. It lets you:

- Open a company by **company ID** (UUID from Deep Research / Universe) and see CRM overview (deal, contacts, emails, timeline).
- Use the API for creating deals from companies, contacts, generating/sending emails, and tracking.

The backend also exposes REST endpoints you can call with curl or Postman (see [frontend/server/docs/crm-foundation.md](../frontend/server/docs/crm-foundation.md)).

## 2. Services to run

1. **Postgres** (existing) – for main app and Deep Research.
2. **FastAPI backend** – `http://localhost:8000` (e.g. `./scripts/start_backend.sh` or `npm run dev:backend`).
3. **Enhanced server (CRM host)** – must be running for `/crm/*` and the CRM page to work:
   - From repo root: `cd frontend && npm run dev` runs both **Vite** (port 8080) and **enhanced-server** (port 3001).
   - Or run only the server: `cd frontend && npx tsx server/enhanced-server.ts` (port 3001).

4. **Frontend (Vite)** – when you run `cd frontend && npm run dev`, the app is at `http://localhost:8080`. Vite proxies `/crm` to the enhanced server (3001), so the CRM page and API work from the same origin.

## 3. Environment variables

Set these in the **root `.env`** (or `frontend/.env.local`). The enhanced server loads root `.env` first, then `frontend/.env.local`.

### Required for CRM API and page

| Variable | Description |
|----------|-------------|
| `POSTGRES_HOST` | Postgres host (default `localhost`). |
| `POSTGRES_PORT` | Postgres port (default `5433` for local dev). |
| `POSTGRES_DB` | Database name (default `nivo`). |
| `POSTGRES_USER` | Postgres user (default `nivo`). |
| `POSTGRES_PASSWORD` | Postgres password (default `nivo`). |

Or use `DATABASE_URL=postgresql://user:pass@host:port/db` instead.

### Optional

| Variable | Description |
|----------|-------------|
| `APP_BASE_URL` | Base URL for tracking links (defaults to `http://localhost:3001`). Set to `http://localhost:8080` when using the Vite app. |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID (for Gmail send). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret. |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token for Gmail API. |
| `GOOGLE_WORKSPACE_SENDER` | Sender email, e.g. `you@yourdomain.com`. |
| `OPENAI_API_KEY` | Already used elsewhere; needed for CRM email generation. |
| `VITE_CRM_SERVER_URL` | Override for Vite proxy target (default `http://localhost:3001`). |

Gmail vars are only needed for **sending** emails (`POST /crm/emails/:emailId/send`). Creating deals, contacts, and generating drafts works without Gmail.

## 4. Postgres: schema and migrations

The CRM uses the **`deep_research`** schema. Run migrations so tables exist:

- `024_deep_research_persistence.sql` – companies, company_profiles, strategy, value_creation
- `026_crm_foundation.sql` – deals, contacts, emails, interactions, tracking_events, sequences
- `032_company_identity_and_prospects_crm_link.sql` – company identity view, prospects↔CRM link

Run: `./scripts/run_postgres_migrations.sh` or apply migrations manually.

**Company identity:** `orgnr` bridges `public.companies` and `deep_research.companies`. `GET /crm/company/:companyId` accepts either UUID or orgnr.

## 5. Quick check

1. Set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` in `.env` (or use defaults for local dev).
2. Start Postgres (e.g. `docker compose -f docker-compose.postgres.yml up -d`).
3. Run migrations if not already applied.
4. Start enhanced server + frontend: `cd frontend && npm run dev`.
5. Open `http://localhost:8080/crm`.
6. Enter a company UUID from `deep_research.companies` and click "Load overview" to test `GET /crm/company/:companyId`.

If the overview fails with "Database client unavailable" or 500, check the enhanced server console and confirm Postgres is running and credentials are correct.

## 6. API overview

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/crm/deals/from-company` | Create or get deal by company ID. |
| GET | `/crm/company/:companyId` | Company CRM overview (deal, contacts, emails, timeline). |
| POST | `/crm/contacts` | Create contact. |
| PATCH | `/crm/contacts/:contactId` | Update contact. |
| POST | `/crm/emails/generate` | Generate draft (uses OpenAI). |
| POST | `/crm/emails/:emailId/approve` | Mark draft approved. |
| POST | `/crm/emails/:emailId/send` | Send via Gmail (needs Google env vars). |
| POST | `/crm/deals/:dealId/notes` | Add note. |
| POST | `/crm/deals/:dealId/status` | Update deal status. |
| GET | `/crm/deals/:dealId/timeline` | Timeline for deal. |
| POST | `/crm/deals/:dealId/enroll-sequence` | Enroll deal in sequence. |

Tracking: `/track/open/:trackingId`, `/track/click/:trackingId` (used in email links).

See [frontend/server/docs/crm-foundation.md](../frontend/server/docs/crm-foundation.md) for more detail.
