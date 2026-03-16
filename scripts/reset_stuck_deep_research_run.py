#!/usr/bin/env python3
"""
Reset a stuck Deep Research run and re-enqueue it.

Use when a run is stuck in "running" (e.g. worker crashed, Redis flushed)
and the UI "Force restart" doesn't work.

Usage:
  python3 scripts/reset_stuck_deep_research_run.py <run_id>

Example:
  python3 scripts/reset_stuck_deep_research_run.py 01fb976c-1682-411d-a71d-17cbd7a8d937

Requires: .env with POSTGRES_* or DATABASE_URL, REDIS_URL
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load .env
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


def get_db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5433")
    db = os.getenv("POSTGRES_DB", "nivo")
    user = os.getenv("POSTGRES_USER", "nivo")
    pw = os.getenv("POSTGRES_PASSWORD", "nivo")
    return f"postgresql://{user}:{pw}@{host}:{port}/{db}"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/reset_stuck_deep_research_run.py <run_id>")
        print("Example: python3 scripts/reset_stuck_deep_research_run.py 01fb976c-1682-411d-a71d-17cbd7a8d937")
        return 1

    run_id_str = sys.argv[1].strip()
    try:
        run_id = uuid.UUID(run_id_str)
    except ValueError:
        print(f"Invalid run_id: {run_id_str}")
        return 1

    import psycopg2
    from psycopg2.extras import RealDictCursor

    db_url = get_db_url()
    conn = psycopg2.connect(db_url)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, status, company_id, query FROM deep_research.analysis_runs WHERE id = %s",
            (str(run_id),),
        )
        run = cur.fetchone()
        if not run:
            print(f"Run not found: {run_id}")
            conn.close()
            return 1

        cur.execute(
            "SELECT id, orgnr, name, website FROM deep_research.companies WHERE id = %s",
            (run["company_id"],),
        )
        company = cur.fetchone()
        if not company:
            print(f"Run has no company. Run ID: {run_id}")
            conn.close()
            return 1

        print(f"Run: {run_id}")
        print(f"  Status: {run['status']}")
        print(f"  Company: {company['name']} ({company['orgnr']})")
        print()

        # Clear run analysis data (each in own transaction so one failure doesn't abort all)
        run_id_str = str(run_id)
        deletes = [
            ("report_sections", "DELETE FROM deep_research.report_sections WHERE report_version_id IN (SELECT id FROM deep_research.report_versions WHERE run_id = %s)"),
            ("report_versions", "DELETE FROM deep_research.report_versions WHERE run_id = %s"),
            ("web_evidence", "DELETE FROM deep_research.web_evidence WHERE run_id = %s"),
            ("web_evidence_rejected", "DELETE FROM deep_research.web_evidence_rejected WHERE run_id = %s"),
            ("web_search_sessions", "DELETE FROM deep_research.web_search_sessions WHERE run_id = %s"),
            ("source_chunks", "DELETE FROM deep_research.source_chunks WHERE source_id IN (SELECT id FROM deep_research.sources WHERE run_id = %s)"),
            ("sources", "DELETE FROM deep_research.sources WHERE run_id = %s"),
            ("claim_verifications", "DELETE FROM deep_research.claim_verifications WHERE claim_id IN (SELECT id FROM deep_research.claims WHERE run_id = %s)"),
            ("claims", "DELETE FROM deep_research.claims WHERE run_id = %s"),
            ("competitor_candidates", "DELETE FROM deep_research.competitor_candidates WHERE run_id = %s"),
            ("market_models", "DELETE FROM deep_research.market_models WHERE run_id = %s"),
            ("positioning_analyses", "DELETE FROM deep_research.positioning_analyses WHERE run_id = %s"),
            ("market_syntheses", "DELETE FROM deep_research.market_syntheses WHERE run_id = %s"),
            ("market_analyses", "DELETE FROM deep_research.market_analyses WHERE run_id = %s"),
            ("company_profiles", "DELETE FROM deep_research.company_profiles WHERE run_id = %s"),
            ("competitors", "DELETE FROM deep_research.competitors WHERE run_id = %s"),
            ("strategies", "DELETE FROM deep_research.strategies WHERE run_id = %s"),
            ("value_creations", "DELETE FROM deep_research.value_creations WHERE run_id = %s"),
            ("financial_models", "DELETE FROM deep_research.financial_models WHERE run_id = %s"),
            ("valuations", "DELETE FROM deep_research.valuations WHERE run_id = %s"),
            ("run_node_states", "DELETE FROM deep_research.run_node_states WHERE run_id = %s"),
            ("report_specs", "DELETE FROM deep_research.report_specs WHERE run_id = %s"),
            ("evidence_bundles", "DELETE FROM deep_research.evidence_bundles WHERE run_id = %s"),
            ("assumption_registries", "DELETE FROM deep_research.assumption_registries WHERE run_id = %s"),
        ]
        for name, sql in deletes:
            try:
                cur.execute(sql, (run_id_str,))
                conn.commit()
            except Exception as e:
                conn.rollback()
                if "does not exist" not in str(e).lower():
                    print(f"  Note: {name}: {e}")

        cur.execute(
            """
            UPDATE deep_research.analysis_runs
            SET status = 'pending', started_at = NULL, completed_at = NULL, error_message = NULL
            WHERE id = %s
            """,
            (str(run_id),),
        )
        conn.commit()
        print("DB: Run reset to pending, analysis data cleared.")
        print()

    conn.close()

    # Enqueue via Redis/RQ (use string path so we don't need to import backend)
    try:
        import redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        redis_conn = redis.from_url(redis_url)
        queue = Queue("deep_research", connection=redis_conn)

        job = queue.enqueue(
            "backend.orchestrator.worker.run_pipeline_job",
            kwargs={
                "run_id": str(run_id),
                "company_name": company["name"],
                "orgnr": company["orgnr"],
                "company_id": str(run["company_id"]),
                "website": company.get("website"),
                "query": run.get("query") or company["name"],
            },
            job_timeout="30m",
        )
        print(f"Redis: Job enqueued (job_id={job.id})")
    except Exception as e:
        print(f"Redis enqueue failed: {e}")
        print("  Run is reset in DB. Start the worker and use 'Restart run' from the UI.")
        return 1

    print()
    print("Done. Worker should pick up the job shortly.")
    print("  Ensure worker is running: ./scripts/start-deep-research-worker.sh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
