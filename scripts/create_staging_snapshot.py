#!/usr/bin/env python3
"""Merge staging SQLite databases into a single snapshot.

Usage:
  python scripts/create_staging_snapshot.py \
    --output staging/combined/staging_50_200.db \
    scraper/allabolag-scraper/staging/staging_151e5a04-14f6-48db-843e-9dad22f371d0.db \
    scraper/allabolag-scraper/staging/staging_af674a42-4859-4e15-a641-9da834ddbb09.db

The script copies all tables from the provided databases (typically
`staging_jobs`, `staging_companies`, `staging_company_ids`, `staging_financials`).
Existing rows are replaced when the primary key matches.
"""

import argparse
import os
import sqlite3
from pathlib import Path


def copy_table(conn: sqlite3.Connection, source_alias: str, table: str) -> None:
    cur = conn.execute(
        "SELECT sql FROM {alias}.sqlite_master WHERE type='table' AND name=?".format(alias=source_alias),
        (table,),
    )
    row = cur.fetchone()
    if row is None:
        return

    create_sql = row[0]
    if create_sql is None:
        return

    target_exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    if not target_exists:
        conn.execute(create_sql)
    conn.execute(
        "INSERT OR REPLACE INTO {table} SELECT * FROM {alias}.{table}".format(
            table=table, alias=source_alias
        )
    )


def merge_databases(output: Path, sources: list[Path]) -> None:
    if output.exists():
        output.unlink()

    output.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(output) as conn:
        for src_path in sources:
            alias = "src"
            conn.execute(f"ATTACH DATABASE ? AS {alias}", (str(src_path),))
            tables = conn.execute(
                f"SELECT name FROM {alias}.sqlite_master WHERE type='table'"
            ).fetchall()

            for (table_name,) in tables:
                copy_table(conn, alias, table_name)

            conn.commit()
            conn.execute(f"DETACH DATABASE {alias}")

        conn.execute("VACUUM")


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge staging SQLite DBs")
    parser.add_argument("sources", nargs="+", help="Source SQLite database files")
    parser.add_argument("--output", required=True, help="Destination SQLite file")
    args = parser.parse_args()

    sources = [Path(s).resolve() for s in args.sources]
    for path in sources:
        if not path.exists():
            parser.error(f"Source database not found: {path}")

    output = Path(args.output).resolve()
    merge_databases(output, sources)

    print(f"Snapshot created at {output}")


if __name__ == "__main__":
    main()

