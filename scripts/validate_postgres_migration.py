#!/usr/bin/env python3
"""
Validate SQLite -> Postgres migration: row counts + sample orgnr checks.

Writes results to docs/POSTGRES_MIGRATION_VALIDATION.md
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SQLITE_PATH = REPO_ROOT / "data" / "nivo_optimized.db"
OUTPUT_PATH = REPO_ROOT / "docs" / "POSTGRES_MIGRATION_VALIDATION.md"


def load_dotenv():
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass


def main() -> int:
    load_dotenv()
    sys.path.insert(0, str(REPO_ROOT))

    import psycopg2

    if not SQLITE_PATH.exists():
        print(f"❌ SQLite not found: {SQLITE_PATH}")
        return 1

    pg_kw = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5433")),
        "dbname": os.getenv("POSTGRES_DB", "nivo"),
        "user": os.getenv("POSTGRES_USER", "nivo"),
        "password": os.getenv("POSTGRES_PASSWORD", "nivo"),
    }

    try:
        pg_conn = psycopg2.connect(**pg_kw)
    except Exception as e:
        print(f"❌ Postgres connection failed: {e}")
        return 1

    sqlite_conn = sqlite3.connect(SQLITE_PATH)

    tables = ["companies", "financials", "company_kpis", "ai_profiles"]
    counts_sqlite = {}
    counts_pg = {}
    for t in tables:
        cur = sqlite_conn.execute(f"SELECT count(*) FROM {t}")
        counts_sqlite[t] = cur.fetchone()[0]
        cur = pg_conn.cursor()
        cur.execute(f"SELECT count(*) FROM {t}")
        counts_pg[t] = cur.fetchone()[0]

    cur = sqlite_conn.execute("SELECT orgnr FROM companies ORDER BY RANDOM() LIMIT 20")
    sample_orgnrs = [r[0] for r in cur.fetchall()]

    samples = []
    for orgnr in sample_orgnrs:
        cur = sqlite_conn.execute("SELECT count(*) FROM companies WHERE orgnr = ?", (orgnr,))
        sq_company = cur.fetchone()[0]
        cur = sqlite_conn.execute("SELECT count(*) FROM financials WHERE orgnr = ?", (orgnr,))
        sq_fin = cur.fetchone()[0]
        cur = sqlite_conn.execute("SELECT count(*) FROM company_kpis WHERE orgnr = ?", (orgnr,))
        sq_kpi = cur.fetchone()[0]

        cur = pg_conn.cursor()
        cur.execute("SELECT count(*) FROM companies WHERE orgnr = %s", (orgnr,))
        pg_company = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM financials WHERE orgnr = %s", (orgnr,))
        pg_fin = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM company_kpis WHERE orgnr = %s", (orgnr,))
        pg_kpi = cur.fetchone()[0]

        match = sq_company == pg_company and sq_fin == pg_fin and sq_kpi == pg_kpi
        samples.append({
            "orgnr": orgnr,
            "sq_company": sq_company, "pg_company": pg_company,
            "sq_fin": sq_fin, "pg_fin": pg_fin,
            "sq_kpi": sq_kpi, "pg_kpi": pg_kpi,
            "match": match,
        })

    sqlite_conn.close()
    pg_conn.close()

    lines = [
        "# Postgres Migration Validation",
        "",
        "## Row counts",
        "",
        "| Table | SQLite | Postgres | Match |",
        "|-------|--------|----------|-------|",
    ]
    for t in tables:
        m = "✅" if counts_sqlite[t] == counts_pg[t] else "❌"
        lines.append(f"| {t} | {counts_sqlite[t]} | {counts_pg[t]} | {m} |")

    lines.extend([
        "",
        "## Sample validation (20 random orgnrs)",
        "",
        "| orgnr | sq_company | pg_company | sq_fin | pg_fin | sq_kpi | pg_kpi | Match |",
        "|-------|------------|------------|--------|--------|--------|--------|-------|",
    ])
    for s in samples:
        m = "✅" if s["match"] else "❌"
        lines.append(f"| {s['orgnr']} | {s['sq_company']} | {s['pg_company']} | {s['sq_fin']} | {s['pg_fin']} | {s['sq_kpi']} | {s['pg_kpi']} | {m} |")

    missing = [t for t in ["ai_queries", "saved_company_lists"] if t not in counts_sqlite]
    lines.extend([
        "",
        "## Missing tables (not in SQLite source)",
        "",
        "- ai_queries: not present in nivo_optimized.db",
        "- saved_company_lists: not present in nivo_optimized.db",
        "",
        "## Rollback",
        "",
        "To reset Postgres and re-migrate:",
        "```bash",
        "docker compose down -v",
        "docker compose up -d",
        "python3 scripts/bootstrap_postgres_schema.py",
        "python3 scripts/migrate_sqlite_to_postgres.py --truncate",
        "```",
    ])

    OUTPUT_PATH.write_text("\n".join(lines))
    print(f"✅ Wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
