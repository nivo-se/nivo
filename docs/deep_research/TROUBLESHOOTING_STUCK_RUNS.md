# Troubleshooting: Stuck Deep Research Runs

When a run is stuck (e.g. "running" but no progress, or "pending" and never starts), use these scripts.

## 1. Diagnose

Check Redis, queue, and run status:

```bash
# Overview (queue + run counts)
python3 scripts/diagnose_deep_research.py

# Specific run
python3 scripts/diagnose_deep_research.py <run_id>
```

Example:
```bash
python3 scripts/diagnose_deep_research.py 01fb976c-1682-411d-a71d-17cbd7a8d937
```

## 2. Reset stuck run

When a run is stuck in "running" (worker crashed, Redis flushed, etc.) and the UI "Force restart" doesn't work:

```bash
python3 scripts/reset_stuck_deep_research_run.py <run_id>
```

This script:
- Resets the run to `pending` in the database
- Clears all analysis data for that run
- Re-enqueues the job to Redis

**Requirements:** Use the backend venv (has redis, rq, psycopg2):
```bash
backend/venv/bin/python scripts/reset_stuck_deep_research_run.py <run_id>
```

Or activate venv first:
```bash
source backend/venv/bin/activate
python3 scripts/reset_stuck_deep_research_run.py <run_id>
```

## 3. Ensure worker is running

After reset, the worker must be running to pick up the job:

```bash
./scripts/start-deep-research-worker.sh
```

Check: `pgrep -fl "rq worker.*deep_research"`
