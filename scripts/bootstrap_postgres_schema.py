#!/usr/bin/env python3
"""
Bootstrap local Postgres schema for Nivo development.

Connects using POSTGRES_* env vars (see .env.example). Applies
database/local_postgres_schema.sql to create tables, indexes, and views.

Usage:
    cd /path/to/nivo
    docker compose up -d   # start Postgres first
    python scripts/bootstrap_postgres_schema.py

Requires: psycopg2 (backend/requirements.txt)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running from repo root; add backend for imports if needed
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

SCHEMA_FILE = REPO_ROOT / "database" / "local_postgres_schema.sql"
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"
LOCAL_MIGRATIONS = [
    "012_add_ai_enrichment_tables.sql",
    "013_add_performance_indexes.sql",
]  # Applied after schema. Run ./scripts/run_postgres_migrations.sh for coverage_metrics (013_add_coverage_view..017)


def load_dotenv() -> None:
    """Load .env from repo root."""
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass  # dotenv optional; rely on env vars


def main() -> int:
    load_dotenv()

    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not found. Install: pip install psycopg2-binary")
        return 1

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5433"))
    dbname = os.getenv("POSTGRES_DB", "nivo")
    user = os.getenv("POSTGRES_USER", "nivo")
    password = os.getenv("POSTGRES_PASSWORD", "nivo")

    print(f"Connecting to Postgres at {host}:{port}/{dbname}...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=5,
        )
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        print("  Ensure Postgres is running: docker compose up -d")
        return 1

    if not SCHEMA_FILE.exists():
        print(f"❌ Schema file not found: {SCHEMA_FILE}")
        return 1

    sql = SCHEMA_FILE.read_text()
    # Split into statements; skip empty and comment-only
    statements = []
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if not stmt or all(line.strip().startswith("--") or not line.strip() for line in stmt.splitlines()):
            continue
        statements.append(stmt)

    print(f"Applying {len(statements)} statements from {SCHEMA_FILE.name}...")
    ok = 0
    err = 0
    with conn.cursor() as cur:
        for i, stmt in enumerate(statements):
            try:
                cur.execute(stmt + ";")
                conn.commit()
                ok += 1
            except Exception as e:
                conn.rollback()
                err += 1
                first_line = stmt.split("\n")[0][:60]
                print(f"  ⚠ Statement {i + 1} failed: {e}")
                print(f"    Preview: {first_line}...")

    # Apply local migrations (e.g. 012 for ai enrichment tables upgrade)
    for mig_name in LOCAL_MIGRATIONS:
        mig_path = MIGRATIONS_DIR / mig_name
        if not mig_path.exists():
            continue
        print(f"\nApplying migration {mig_name}...")
        mig_sql = mig_path.read_text()
        for stmt in mig_sql.split(";"):
            stmt = stmt.strip()
            if not stmt:
                continue
            # Skip only pure-comment statements (all lines are comments or empty)
            lines = [l for l in stmt.splitlines() if l.strip()]
            if lines and all(l.strip().startswith("--") for l in lines):
                continue
            try:
                with conn.cursor() as cur:
                    cur.execute(stmt + ";")
                    conn.commit()
                    ok += 1
            except Exception as e:
                conn.rollback()
                err += 1
                print(f"  ⚠ Migration statement failed: {e}")

    conn.close()

    if err == 0:
        print(f"\n✅ Bootstrap complete. {ok} statements applied successfully.")
        return 0
    else:
        print(f"\n⚠ Bootstrap finished with errors: {ok} ok, {err} failed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
