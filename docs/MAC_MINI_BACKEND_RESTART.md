# Mac Mini — Backend only (frontend on Vercel)

Backend runs on the Mac; Postgres in Docker. Frontend is deployed on Vercel.

## One command: pull, migrate, restart

From repo root:

```bash
./scripts/pull_and_restart_backend.sh
```

This script:

1. Brings up Postgres (Docker)
2. `git pull`
3. Runs Postgres migrations
4. Stops any process on port 8000, then starts the backend

Health: `curl http://localhost:8000/health`

## Manual fallback

If you need steps separately: start Postgres (`docker compose -f docker-compose.postgres.yml up -d`), pull, run `./scripts/run_postgres_migrations.sh`, then `./scripts/start_backend.sh` (with venv activated and `DATABASE_SOURCE=postgres`).
