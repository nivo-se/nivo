#!/usr/bin/env python3
"""
Phase D: offline SQL dry-run — run EXPLAIN (no DML) against Postgres using the same
env as the app (DATABASE_URL or POSTGRES_*). Does not execute arbitrary prod writes.

Usage:
  python3 scripts/screening_sql_dry_run.py path/to/query.sql
  python3 scripts/screening_sql_dry_run.py path/to/query.sql --analyze

Requires: psycopg2-binary (already used by the backend).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _connect():
    import psycopg2

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=5)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=5,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="EXPLAIN a SQL file (dry-run).")
    ap.add_argument("sql_file", type=Path, help="Path to .sql file")
    ap.add_argument(
        "--analyze",
        action="store_true",
        help="Use EXPLAIN (ANALYZE, BUFFERS) — runs the query (read-only SELECT only; avoid on prod)",
    )
    args = ap.parse_args()
    sql = args.sql_file.read_text(encoding="utf-8")
    lowered = sql.strip().lower()
    if any(
        kw in lowered
        for kw in ("insert ", "update ", "delete ", "truncate ", "alter ", "drop ", "create ")
    ):
        print(
            "Refusing: file appears to contain DML/DDL. Use read-only SELECT for dry-run.",
            file=sys.stderr,
        )
        sys.exit(2)
    prefix = "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)" if args.analyze else "EXPLAIN (FORMAT TEXT)"
    wrapped = f"{prefix}\n{sql}"
    conn = _connect()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(wrapped)
            rows = cur.fetchall()
        for row in rows:
            print(row[0])
    finally:
        conn.close()


if __name__ == "__main__":
    main()
