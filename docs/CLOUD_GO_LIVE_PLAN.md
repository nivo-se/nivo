# Cloud Go-Live Plan (All Services)

## Target architecture
- Frontend web app: static build from `frontend/` on Vercel (or Cloudflare Pages/Netlify).
- API backend: FastAPI from `backend/api/main.py` as container service (Railway/Render/Fly.io/ECS).
- Primary database: managed Postgres (Neon/Supabase Postgres/RDS) with TLS.
- Background queue: Redis (Upstash/Redis Cloud) + RQ worker (`scripts/start-worker.sh` equivalent container).
- Optional scraper service: separate deployment for scraper UI/workers (do not couple to frontend runtime).

## Service responsibilities
- Frontend (`frontend/`): UI only, no DB writes directly.
- Backend API (`backend/api/*`): canonical business API under `/api/*`.
- Worker (`backend/workers/*`): async enrichment/analysis jobs from Redis queues.
- Postgres: system of record for companies/financials/lists/prospects/analysis.
- Redis: transient queue state only.

## Phase 0: Pre-flight blockers (must pass before deploy)
1. Restore lint gate (`npm run lint`) and dependency compatibility.
2. Replace outdated CI workflow (`.github/workflows/dashboard-api-tests.yml`) with current smoke checks.
3. Update `.env.example` for Postgres default (`DATABASE_SOURCE=postgres`).
4. Remove `._*` file artifacts from source and block new ones.
5. Remove hardcoded localhost API usage in frontend components.

## Phase 1: Infrastructure provisioning
1. Create managed Postgres instance.
2. Create managed Redis instance.
3. Create object storage bucket if scraper/output artifacts must be retained.
4. Provision secrets in cloud secret manager:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `OPENAI_API_KEY`
   - `SUPABASE_JWT_SECRET` (if auth enabled)
   - `CORS_ORIGINS`
   - `REQUIRE_AUTH=true` for production

## Phase 2: Backend deployment
1. Build and deploy backend container from repo.
2. Run DB bootstrap/migrations (read-only verify after each step):
   - `python scripts/bootstrap_postgres_schema.py`
   - `./scripts/run_postgres_migrations.sh`
3. Set runtime envs:
   - `DATABASE_SOURCE=postgres`
   - `DATABASE_URL=<managed-postgres-url>`
   - `REDIS_URL=<managed-redis-url>`
   - `REQUIRE_AUTH=true`
   - `CORS_ORIGINS=https://<frontend-domain>`
4. Health checks:
   - `/health`
   - `/api/status`
   - `/api/db/info`

## Phase 3: Worker deployment
1. Deploy separate worker process image/command:
   - `rq worker enrichment ai_analysis --url $REDIS_URL`
2. Validate worker can pull jobs from backend queues.
3. Add autoscaling policy by queue length and job latency.

## Phase 4: Frontend deployment
1. Deploy `frontend/dist` to Vercel/static host.
2. Set frontend env:
   - `VITE_API_BASE_URL=https://<api-domain>`
3. Ensure router fallback to `index.html` for SPA paths.
4. Verify CORS + auth flow from browser.

## Phase 5: Scraper/auxiliary services
1. Decide if scraper UI is production-facing.
2. If yes, deploy as isolated service with its own API base settings.
3. Remove localhost-only links and route via environment-configured endpoints.

## Phase 6: Production validation checklist
1. API smoke:
   - `./scripts/smoke_api_endpoints.sh`
2. Frontend-service smoke:
   - `backend/.venv/bin/python scripts/smoke_frontend_services.py`
3. Financial payload smoke:
   - `./scripts/smoke_financials_endpoint.sh`
4. App route smoke (manual):
   - `/universe`, `/lists`, `/company/:id`, `/prospects`, `/ai/runs`
5. Auth smoke:
   - anonymous blocked where expected
   - signed-in flow works end to end

## Observability and operations
- API logs with request id and status code.
- Worker logs with job id, orgnr/list id, retry count.
- Error aggregation (Sentry or equivalent) for frontend + backend.
- DB monitoring:
  - connection saturation
  - slow query logs
  - table growth and vacuum health
- Alerting:
  - `/health` down
  - worker queue backlog threshold
  - 5xx error rate threshold

## Rollout strategy
1. Staging deploy (mirror production envs with smaller DB/Redis).
2. Run full smoke suite and manual route checks.
3. Canary production deploy (low traffic window).
4. Observe 24h; then full cutover.
5. Keep rollback target:
   - prior backend image
   - prior frontend deployment
   - DB schema backward-compatible migration policy.

## Minimal CI/CD pipeline (recommended)
1. On PR:
   - `frontend` typecheck/build
   - naming guardrails
   - static scans for localhost hardcoding in production paths
2. On merge to main:
   - deploy backend to staging
   - run smoke scripts
   - deploy frontend to staging
   - promote to production on manual approval

## Go/No-Go gate
Go live only when all are true:
- Lint + typecheck + build pass.
- Smoke scripts pass against staging and production.
- No hardcoded localhost endpoints in production-rendered paths.
- Worker queue processing verified.
- Auth + CORS verified with production domains.
