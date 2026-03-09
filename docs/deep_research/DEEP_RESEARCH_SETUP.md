# Deep Research Setup

This document describes how to run the Deep Research pipeline locally. For full validation flow, see [FINAL_TASK_LIVE_VALIDATION.md](./FINAL_TASK_LIVE_VALIDATION.md).

---

## Required services

| Service       | Purpose                          |
| ------------- | -------------------------------- |
| PostgreSQL    | Database for runs, reports, data |
| Redis         | Job queue for async runs         |
| Backend API   | HTTP API and orchestration       |
| RQ worker     | Processes Deep Research jobs     |

---

## Start order

1. **PostgreSQL** — Start first (Docker or local).
2. **Redis** — Start before the worker.
3. **Backend API** — `uvicorn` or your usual backend start.
4. **RQ worker** — From repo root: `./scripts/start-deep-research-worker.sh`

---

## Environment variables

| Variable         | Required | Notes                                      |
| ---------------- | -------- | ------------------------------------------ |
| `POSTGRES_HOST`  | Yes      | `localhost` or DB host                     |
| `POSTGRES_PORT`  | Yes      | `5432` or `5433` (local Docker)            |
| `POSTGRES_DB`    | Yes      | Database name (e.g. `nivo`)                |
| `POSTGRES_USER`  | Yes      | DB user                                    |
| `POSTGRES_PASSWORD` | Yes   | DB password                                |
| `REDIS_URL`      | Yes      | `redis://localhost:6379/0` or your Redis   |
| `OPENAI_API_KEY` | Yes      | `sk-...` from OpenAI                       |
| `TAVILY_API_KEY` | Optional | For web retrieval; otherwise limited      |

---

## Quick checks

| Check              | Command                                                       |
| ------------------ | ------------------------------------------------------------- |
| Redis              | `redis-cli ping` → expect `PONG`                              |
| Deep Research API  | `curl http://localhost:8000/api/deep-research/health`         |
| Worker process     | Ensure `rq worker deep_research` is running (via the script)   |

---

## Starting the RQ worker

The worker is **started automatically** when you start the backend via:

- `./scripts/start_backend.sh` (used by `npm run dev:backend`)
- `./scripts/start-backend.sh`
- `./scripts/start-all.sh`

To start the worker manually (e.g. if you run the backend differently):

```bash
./scripts/start-worker.sh
```

This runs `rq worker enrichment ai_analysis deep_research` — one worker handles all queues including Deep Research. Redis must be running first.

---

## Troubleshooting

- **Runs stay "Pending"** — The RQ worker is not running. Start it with `./scripts/start-deep-research-worker.sh`.
- **Redis connection refused** — Start Redis (e.g. `redis-server` or Docker) and verify with `redis-cli ping`.
- **Health endpoint fails** — Ensure the backend is running and reachable at `http://localhost:8000`.
