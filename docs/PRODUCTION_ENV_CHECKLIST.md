# Production Environment Checklist

Copy/paste and fill in. These env vars **must** be set in production.

## Auth

| Variable | Example | Required |
|----------|---------|----------|
| `REQUIRE_AUTH` | `true` | Yes |
| `SUPABASE_JWT_SECRET` | (from Supabase Project Settings → API → JWT Secret) | Yes when `REQUIRE_AUTH=true` |

## Database (Supabase Postgres)

Use `DATABASE_SOURCE=postgres` with Supabase's Postgres connection. Do **not** use `DATABASE_SOURCE=supabase` (not implemented; fails fast).

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_SOURCE` | `postgres` | Yes |
| `POSTGRES_HOST` | `db.xxxx.supabase.co` | Yes |
| `POSTGRES_PORT` | `5432` | Yes (Supabase uses 5432; local Docker was 5433) |
| `POSTGRES_DB` | `postgres` | Yes |
| `POSTGRES_USER` | `postgres` | Yes |
| `POSTGRES_PASSWORD` | (from Supabase project) | Yes |

## CORS

| Variable | Example | Required |
|----------|---------|----------|
| `CORS_ORIGINS` | `https://your-app.vercel.app,https://your-domain.com` | Yes |
| `CORS_ALLOW_VERCEL_PREVIEWS` | `true` | Optional; enables `*.vercel.app` when needed |

## RQ (Redis)

Enrichment jobs enqueue to Redis. If Redis is down, enrichment falls back to sync (can block/timeout).

| Variable | Example | Required |
|----------|---------|----------|
| `REDIS_URL` | `redis://default:xxx@xxx.railway.internal:6379` | Yes for async enrichment |

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
