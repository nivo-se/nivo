#!/usr/bin/env python3
"""Export normalized financial accounts from SQLite to CSV."""

from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path
from typing import Sequence


COLUMNS: Sequence[str] = (
    "financial_id",
    "orgnr",
    "year",
    "period",
    "account_code",
    "amount_sek",
    "created_at",
)


def export_csv(db_path: Path, output_path: Path, batch_size: int = 10000) -> None:
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {db_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn, output_path.open("w", newline="", encoding="utf-8") as fh:
        conn.row_factory = sqlite3.Row
        writer = csv.writer(fh)
        writer.writerow(COLUMNS)

        query = (
            "SELECT financial_id, orgnr, year, period, account_code, amount_sek, created_at "
            "FROM financial_accounts ORDER BY orgnr, year, period, account_code"
        )

        cur = conn.execute(query)
        while True:
            rows = cur.fetchmany(batch_size)
            if not rows:
                break
            for row in rows:
                writer.writerow([row[col] for col in COLUMNS])

    print(f"Exported {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export financial_accounts table to CSV")
    parser.add_argument(
        "--db",
        default="data/new_schema_local.db",
        help="Path to local SQLite database",
    )
    parser.add_argument(
        "--out",
        default="data/csv_export/financial_accounts.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10000,
        help="Number of rows to fetch per batch",
    )

    args = parser.parse_args()
    export_csv(Path(args.db), Path(args.out), batch_size=args.batch_size)


if __name__ == "__main__":
    main()

