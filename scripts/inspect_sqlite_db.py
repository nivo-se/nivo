#!/usr/bin/env python3
"""
Inspect a SQLite database: tables, row counts, columns for AI-relevant tables.
Detects primary key and orgnr-related columns.

Usage:
    python3 scripts/inspect_sqlite_db.py --db data/nivo_optimized.db
    python3 scripts/inspect_sqlite_db.py --db /path/to/nivo-v2/db.sqlite
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# AI/enrichment-related table name patterns
AI_TABLE_PATTERNS = (
    "ai", "llm", "enrich", "about", "website", "summary", "profile",
    "prompt", "run", "scraped", "metadata", "intel", "artifact",
)


def _is_ai_relevant(name: str) -> bool:
    n = name.lower()
    return any(p in n for p in AI_TABLE_PATTERNS)


def _detect_orgnr_column(columns: list[tuple]) -> str | None:
    """Return column name that looks like orgnr/org_number/organization_number."""
    candidates = ("orgnr", "org_number", "organization_number", "company_id", "org_num")
    col_names = [c[1].lower() for c in columns]
    for cand in candidates:
        if cand in col_names:
            return cand
    for cn in col_names:
        if "org" in cn and ("nr" in cn or "num" in cn or "number" in cn):
            return cn
    return None


def _get_primary_key(conn: sqlite3.Connection, table: str) -> str | None:
    cur = conn.execute(f"PRAGMA table_info({table})")
    for row in cur.fetchall():
        if row[5]:  # pk
            return row[1]
    return None


def inspect(db_path: Path) -> dict:
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # List tables
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    tables = [r[0] for r in cur.fetchall()]

    result = {
        "path": str(db_path),
        "tables": {},
        "ai_tables": [],
    }

    for table in sorted(tables):
        cur = conn.execute(f"SELECT COUNT(*) FROM [{table}]")
        count = cur.fetchone()[0]

        cur = conn.execute(f"PRAGMA table_info({table})")
        columns = [(r[0], r[1], r[2], r[3], r[4], r[5]) for r in cur.fetchall()]
        col_list = [c[1] for c in columns]

        pk = _get_primary_key(conn, table)
        orgnr_col = _detect_orgnr_column(columns)

        result["tables"][table] = {
            "row_count": count,
            "columns": col_list,
            "primary_key": pk,
            "orgnr_column": orgnr_col,
        }
        if _is_ai_relevant(table):
            result["ai_tables"].append(table)

    conn.close()
    return result


def print_report(data: dict) -> None:
    print(f"Database: {data['path']}")
    print("=" * 60)
    print("\nAll tables:")
    for table, info in sorted(data["tables"].items()):
        pk = info["primary_key"] or "-"
        orgnr = info["orgnr_column"] or "-"
        print(f"  {table}: {info['row_count']} rows, pk={pk}, orgnr_col={orgnr}")

    print("\nAI-relevant tables:")
    for t in data["ai_tables"]:
        info = data["tables"][t]
        print(f"\n  {t} ({info['row_count']} rows)")
        print(f"    pk={info['primary_key']}, orgnr_col={info['orgnr_column']}")
        print(f"    columns: {info['columns']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect SQLite database")
    parser.add_argument("--db", required=True, type=Path, help="Path to SQLite database")
    args = parser.parse_args()

    try:
        data = inspect(args.db)
        print_report(data)
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
