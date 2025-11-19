#!/usr/bin/env python3
"""Validation helpers for local financial_accounts materialisation."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Iterable


def ensure_db(path: Path) -> sqlite3.Connection:
    if not path.exists():
        raise FileNotFoundError(f"SQLite database not found: {path}")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def scalar(conn: sqlite3.Connection, query: str, params: Iterable = ()) -> int:
    cur = conn.execute(query, tuple(params))
    row = cur.fetchone()
    if row is None:
        return 0
    value = row[0]
    return int(value) if value is not None else 0


def validate_counts(conn: sqlite3.Connection) -> None:
    financial_records = scalar(conn, "SELECT COUNT(*) FROM company_financials")
    account_rows = scalar(conn, "SELECT COUNT(*) FROM financial_accounts")
    distinct_financial_ids = scalar(conn, "SELECT COUNT(DISTINCT financial_id) FROM financial_accounts")

    print("=== Record Counts ===")
    print(f"company_financials rows : {financial_records:,}")
    print(f"financial_accounts rows : {account_rows:,}")
    print(f"financial_ids covered   : {distinct_financial_ids:,}")

    missing_accounts = scalar(
        conn,
        """
        SELECT COUNT(*)
        FROM company_financials cf
        LEFT JOIN financial_accounts fa ON fa.financial_id = cf.id
        WHERE fa.financial_id IS NULL
        """,
    )
    print(f"financials without accounts : {missing_accounts:,}")


def validate_account_distribution(conn: sqlite3.Connection, top_n: int = 20) -> None:
    print("\n=== Top Account Codes ===")
    cur = conn.execute(
        """
        SELECT account_code, COUNT(*) as cnt
        FROM financial_accounts
        GROUP BY account_code
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (top_n,),
    )
    for code, count in cur.fetchall():
        print(f"{code:<20} {count:,}")


def validate_amounts(conn: sqlite3.Connection, sample_size: int = 5) -> None:
    print("\n=== Sample Amount Checks ===")
    cur = conn.execute(
        """
        SELECT cf.orgnr,
               cf.year,
               cf.period,
               cf.account_codes,
               fa.account_code,
               fa.amount_sek
        FROM financial_accounts fa
        JOIN company_financials cf ON cf.id = fa.financial_id
        ORDER BY RANDOM()
        LIMIT ?
        """,
        (sample_size,),
    )

    for row in cur.fetchall():
        orgnr = row["orgnr"]
        year = row["year"]
        period = row["period"]
        code = row["account_code"]
        amount = row["amount_sek"]
        try:
            codes = json.loads(row["account_codes"] or "{}")
        except json.JSONDecodeError:
            codes = {}
        source_value = codes.get(code)
        status = "OK" if source_value is not None and abs(source_value - amount) < 0.01 else "MISMATCH"
        print(f"{orgnr} {year}/{period} {code:<8} stored={amount:.2f} source={source_value} [{status}]")


def report_per_company(conn: sqlite3.Connection, limit: int = 5) -> None:
    print("\n=== Accounts per Company (sample) ===")
    cur = conn.execute(
        """
        SELECT orgnr, year, COUNT(*) as cnt
        FROM financial_accounts
        GROUP BY orgnr, year
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (limit,),
    )
    for orgnr, year, cnt in cur.fetchall():
        print(f"{orgnr} {year}: {cnt} accounts")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate local financial_accounts data")
    parser.add_argument(
        "--db",
        default="data/new_schema_local.db",
        help="Path to local SQLite database",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=20,
        help="How many account codes to list",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=5,
        help="Number of random samples for amount checks",
    )
    parser.add_argument(
        "--company-sample",
        type=int,
        default=5,
        help="How many companies to show in per-company breakdown",
    )

    args = parser.parse_args()
    with ensure_db(Path(args.db)) as conn:
        validate_counts(conn)
        validate_account_distribution(conn, top_n=args.top)
        validate_amounts(conn, sample_size=args.samples)
        report_per_company(conn, limit=args.company_sample)


if __name__ == "__main__":
    main()

