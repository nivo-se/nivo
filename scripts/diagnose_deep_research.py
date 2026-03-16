#!/usr/bin/env python3
"""
Diagnose Deep Research worker and queue status.

Usage:
  python3 scripts/diagnose_deep_research.py [run_id]

If run_id is provided, shows detailed status for that run.
Otherwise shows queue and worker overview.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

env_path = REPO_ROOT / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path)
    except ImportError:
        with env_path.open() as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

os.environ.setdefault("DATABASE_SOURCE", "postgres")


def main() -> int:
    run_id_arg = sys.argv[1] if len(sys.argv) > 1 else None

    # Redis
    print("=== Redis ===")
    try:
        import redis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(url)
        r.ping()
        print("  OK")
        queue_len = r.llen("rq:queue:deep_research")
        print(f"  deep_research queue: {queue_len} jobs")
    except Exception as e:
        print(f"  FAIL: {e}")
        return 1

    # DB run status (use raw psycopg2 to avoid backend Python version issues)
    print()
    print("=== Database ===")
    import psycopg2
    from psycopg2.extras import RealDictCursor

    def get_db_url():
        url = os.getenv("DATABASE_URL")
        if url:
            return url
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5433")
        db = os.getenv("POSTGRES_DB", "nivo")
        user = os.getenv("POSTGRES_USER", "nivo")
        pw = os.getenv("POSTGRES_PASSWORD", "nivo")
        return f"postgresql://{user}:{pw}@{host}:{port}/{db}"

    conn = psycopg2.connect(get_db_url())
    run_status = None
    pending_count = 0
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if run_id_arg:
                try:
                    run_id = uuid.UUID(run_id_arg)
                except ValueError:
                    print(f"  Invalid run_id: {run_id_arg}")
                    conn.close()
                    return 1
                cur.execute(
                    "SELECT id, status, company_id, started_at, error_message FROM deep_research.analysis_runs WHERE id = %s",
                    (str(run_id),),
                )
                run = cur.fetchone()
                if not run:
                    print(f"  Run not found: {run_id}")
                    conn.close()
                    return 1
                run_status = run["status"]
                cur.execute(
                    "SELECT name, orgnr FROM deep_research.companies WHERE id = %s",
                    (str(run["company_id"]) if run["company_id"] else None,),
                )
                company = cur.fetchone()
                print(f"  Run: {run['id']}")
                print(f"  Status: {run['status']}")
                print(f"  Company: {company['name'] if company else '—'} ({company['orgnr'] if company else '—'})")
                print(f"  Started: {run['started_at']}")
                print(f"  Error: {run['error_message'] or '—'}")
            else:
                cur.execute(
                    "SELECT COUNT(*) FROM deep_research.analysis_runs WHERE status = 'running'"
                )
                running = cur.fetchone()["count"]
                cur.execute(
                    "SELECT COUNT(*) FROM deep_research.analysis_runs WHERE status = 'pending'"
                )
                pending_count = cur.fetchone()["count"]
                print(f"  Runs pending: {pending_count}")
                print(f"  Runs running: {running}")
                if running > 0:
                    cur.execute(
                        "SELECT id, started_at FROM deep_research.analysis_runs WHERE status = 'running' LIMIT 5"
                    )
                    for r in cur.fetchall():
                        print(f"    - {r['id']} (started {r['started_at']})")
    finally:
        conn.close()

    print()
    print("=== Next steps ===")
    if run_id_arg and run_status == "running":
        print("  Run is stuck in 'running'. Reset with:")
        print(f"    python3 scripts/reset_stuck_deep_research_run.py {run_id_arg}")
    elif queue_len == 0 and pending_count > 0:
        print("  Jobs in queue: 0, but runs are pending. Worker may not be running.")
        print("  Start worker: ./scripts/start-deep-research-worker.sh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
