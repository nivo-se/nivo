# Production Environment Checklist

Copy/paste and fill in. These env vars **must** be set in production.

## Auth

| Variable | Example | Required |
|----------|---------|----------|
| `REQUIRE_AUTH` | `true` | Yes |
| `JWT_SECRET` | (secret for verifying Bearer tokens) | Yes when `REQUIRE_AUTH=true` |

## Database (Postgres)

Use `DATABASE_SOURCE=postgres` with your Postgres connection (Mac Mini or local Docker).

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_SOURCE` | `postgres` | Yes |
| `DATABASE_URL` or `POSTGRES_*` | Connection URL or host/port/db/user/password | Yes |
| `POSTGRES_HOST` | `localhost` or your DB host | When not using `DATABASE_URL` |
| `POSTGRES_PORT` | `5432` or `5433` (local Docker) | When not using `DATABASE_URL` |
| `POSTGRES_DB` | `nivo` | Yes |
| `POSTGRES_USER` | `nivo` | Yes |
| `POSTGRES_PASSWORD` | (your DB password) | Yes |

## CORS (FastAPI; also set equivalent origins on the Node enhanced server for CRM)

| Variable | Example | Required |
|----------|---------|----------|
| `CORS_ORIGINS` | `https://your-app.vercel.app,https://your-domain.com` | Yes |
| `CORS_ALLOW_VERCEL_PREVIEWS` | `true` | Optional; enables `*.vercel.app` when needed |

## CRM (Vite / Vercel) — Node enhanced server

CRM uses **Node** (`frontend/server`, `/crm/...`), not FastAPI. The Vercel build is static: **same-origin** `/crm` in production does not proxy; you must point the app at a host that actually runs the enhanced server (e.g. your tunnel / VM).

| Variable | Where | Example | Required for CRM in prod |
|----------|--------|---------|---------------------------|
| `VITE_CRM_BASE_URL` | **Vercel** (Vite, build-time) | `https://crm.nivogroup.se` (origin only; your Node/tunnel host) | Yes — or CRM calls return HTML/404 and “could not load email settings” |
| (Node host `.env`) | same host as `VITE_CRM_BASE_URL` | `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `DATABASE_URL` / `POSTGRES_*`, Gmail OAuth, etc. | Yes for save/send from CRM |

`VITE_API_BASE_URL` (FastAPI) and `VITE_CRM_BASE_URL` (Node) are **different** services.

## RQ (Redis)

Enrichment jobs enqueue to Redis. If Redis is down, enrichment falls back to sync (can block/timeout).

| Variable | Example | Required |
|----------|---------|----------|
| `REDIS_URL` | `redis://localhost:6379/0` (Mac Mini) or your Redis URL | Yes for async enrichment |

**Sanity checks:**
- `POST /api/enrichment/run` returns `{run_id, job_id}`
- `GET /api/enrichment/run/{run_id}/status` shows progress over time  
If status never changes, the **RQ worker is not running**.

## LLM (OpenAI or LMStudio)

| Variable | Example | Required |
|----------|---------|----------|
| `LLM_BASE_URL` | `https://api.openai.com/v1` or `http://localhost:1234/v1` | When using LMStudio |
| `LLM_API_KEY` | (OpenAI key or dummy for LMStudio) | Yes for hosted |
| `LLM_MODEL` | `gpt-4o-mini` or your model name | Yes |
| `LLM_PROVIDER` | `openai_compat` | Default; rarely needed |
| `LLM_TIMEOUT_SECONDS` | `60` | Optional |

## Quick Verification

After deploy, call `GET /api/status/config` (no auth) to see effective config (secrets redacted):

- `db_source`
- `require_auth`
- `cors_origins_count`
- `redis_connected`
- `llm_provider`
