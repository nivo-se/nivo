#!/usr/bin/env python3
"""
Financial coverage audit (read-only).
Prints counts and samples for the financials table. Exit code 0 always; informational only.

Usage:
  export DATABASE_SOURCE=postgres  # optional if using POSTGRES_* or DATABASE_URL
  python scripts/audit_financial_coverage.py

Requires: psycopg2 (backend/requirements.txt)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def connect():
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not found. Install: pip install psycopg2-binary")
        sys.exit(0)  # exit 0 per plan (informational)

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=10)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=10,
    )


def main() -> None:
    print("Financial coverage audit (read-only)")
    print("=" * 50)

    try:
        conn = connect()
    except Exception as e:
        print(f"Could not connect to Postgres: {e}")
        print("Set DATABASE_URL or POSTGRES_* env vars.")
        sys.exit(0)

    cur = conn.cursor()

    # Check financials table exists
    cur.execute("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'financials'
    """)
    if not cur.fetchone():
        print("Table 'financials' not found. Skipping audit.")
        conn.close()
        sys.exit(0)

    # Companies count
    cur.execute("SELECT COUNT(*) FROM companies")
    companies_count = cur.fetchone()[0]
    print(f"Companies count: {companies_count}")

    # Financials rows count
    cur.execute("SELECT COUNT(*) FROM financials")
    financials_rows = cur.fetchone()[0]
    print(f"Financials rows count: {financials_rows}")

    # Companies with >= 3 years financials
    cur.execute("""
        SELECT COUNT(DISTINCT orgnr)
        FROM (
            SELECT orgnr, COUNT(DISTINCT year) AS years
            FROM financials
            GROUP BY orgnr
            HAVING COUNT(DISTINCT year) >= 3
        ) t
    """)
    companies_3y = cur.fetchone()[0]
    print(f"Companies with >= 3 years financials: {companies_3y}")

    # Companies with account_codes not null and not empty
    cur.execute("""
        SELECT COUNT(DISTINCT orgnr)
        FROM financials
        WHERE account_codes IS NOT NULL
          AND account_codes::text != 'null'
          AND account_codes::text != '{}'
    """)
    companies_with_ac = cur.fetchone()[0]
    print(f"Companies with non-empty account_codes (any year): {companies_with_ac}")

    # Sample 20 orgnr that have at least one row with empty account_codes
    cur.execute("""
        SELECT DISTINCT orgnr
        FROM financials
        WHERE account_codes IS NULL
           OR account_codes::text = 'null'
           OR account_codes::text = '{}'
        LIMIT 20
    """)
    sample_empty_ac = [row[0] for row in cur.fetchall()]
    print(f"\nSample 20 orgnr with empty account_codes (at least one year):")
    for orgnr in sample_empty_ac:
        print(f"  {orgnr}")

    conn.close()
    print("\nDone (informational only, exit 0).")
    sys.exit(0)


if __name__ == "__main__":
    main()
