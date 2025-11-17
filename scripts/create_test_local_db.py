#!/usr/bin/env python3
"""
Create a lightweight SQLite database so dashboard API tests can run in CI.

The real `data/new_schema_local.db` file is large and excluded from git, so
we synthesize a minimal version with the handful of tables and columns used
by `frontend/server/enhanced-server.ts`:

  - companies
  - company_metrics
  - company_financials
  - financial_accounts

Only two sample companies are inserted (the same org numbers referenced in
`dashboard_api_test_config.json`). The structure matches the production schema
closely enough for read-only dashboard queries.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "new_schema_local.db"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def reset_db(path: Path) -> sqlite3.Connection:
    allow_overwrite = (
        os.getenv("CREATE_TEST_LOCAL_DB_FORCE") == "1" or os.getenv("CI") == "true"
    )
    if path.exists() and not allow_overwrite:
        raise SystemExit(
            f"{path} already exists. Refusing to overwrite without "
            "`CREATE_TEST_LOCAL_DB_FORCE=1`."
        )
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=OFF;")
    return conn


def bootstrap_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE companies (
            orgnr TEXT PRIMARY KEY,
            company_id TEXT,
            company_name TEXT,
            company_type TEXT,
            homepage TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            segment_names TEXT,
            nace_codes TEXT,
            foundation_year INTEGER,
            employees_latest INTEGER,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE company_metrics (
            orgnr TEXT PRIMARY KEY,
            latest_year INTEGER,
            latest_revenue_sek REAL,
            latest_profit_sek REAL,
            latest_ebitda_sek REAL,
            revenue_cagr_3y REAL,
            revenue_cagr_5y REAL,
            avg_ebitda_margin REAL,
            avg_net_margin REAL,
            digital_presence INTEGER,
            company_size_bucket TEXT,
            growth_bucket TEXT,
            profitability_bucket TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE company_financials (
            id TEXT PRIMARY KEY,
            orgnr TEXT NOT NULL,
            company_id TEXT,
            year INTEGER,
            period TEXT,
            raw_json TEXT
        );

        CREATE TABLE financial_accounts (
            id TEXT PRIMARY KEY,
            financial_id TEXT,
            orgnr TEXT NOT NULL,
            account_code TEXT,
            amount_sek REAL,
            year INTEGER,
            period TEXT
        );
        """
    )


def insert_sample_data(conn: sqlite3.Connection) -> None:
    companies = [
        {
            "orgnr": "5560001421",
            "company_name": "Nordstjernan Aktiebolag",
            "segment_names": ["Tillverkning"],
            "address": {
                "streetAddress": {
                    "streetName": "Testgatan",
                    "streetNumber": "1",
                    "postCode": "111 22",
                    "postPlace": "Stockholm",
                },
                "visitorAddress": {"streetName": "Testgatan", "postPlace": "Stockholm"},
            },
            "homepage": "https://nordstjernan.se",
            "email": "info@nordstjernan.se",
            "foundation_year": 1944,
            "employees_latest": 17,
        },
        {
            "orgnr": "5560002064",
            "company_name": "Svea Analys AB",
            "segment_names": ["Tjänster"],
            "address": {
                "streetAddress": {
                    "streetName": "Analysgatan",
                    "streetNumber": "12",
                    "postCode": "411 15",
                    "postPlace": "Göteborg",
                },
                "visitorAddress": {"streetName": "Analysgatan", "postPlace": "Göteborg"},
            },
            "homepage": "https://sveaanalys.se",
            "email": "kontakt@sveaanalys.se",
            "foundation_year": 1980,
            "employees_latest": 32,
        },
    ]

    company_rows = []
    for company in companies:
        company_rows.append(
            dict(
                orgnr=company["orgnr"],
                company_id=None,
                company_name=company["company_name"],
                homepage=company["homepage"],
                email=company["email"],
                address=json.dumps(company["address"]),
                segment_names=json.dumps(company["segment_names"]),
                foundation_year=company["foundation_year"],
                employees_latest=company["employees_latest"],
            )
        )

    conn.executemany(
        """
        INSERT INTO companies (
            orgnr, company_id, company_name, company_type,
            homepage, email, phone, address, segment_names, nace_codes,
            foundation_year, employees_latest, created_at, updated_at
        ) VALUES (
            :orgnr, :company_id, :company_name, 'AB',
            :homepage, :email, NULL, :address, :segment_names, NULL,
            :foundation_year, :employees_latest, datetime('now'), datetime('now')
        )
        """,
        company_rows,
    )

    metrics = [
        dict(
            orgnr="5560001421",
            latest_year=2024,
            latest_revenue_sek=72000,
            latest_profit_sek=6300,
            latest_ebitda_sek=8200,
            revenue_cagr_3y=0.12,
            avg_ebitda_margin=0.11,
            avg_net_margin=0.08,
            digital_presence=1,
            company_size_bucket="medium",
            growth_bucket="medium",
            profitability_bucket="positive",
        ),
        dict(
            orgnr="5560002064",
            latest_year=2024,
            latest_revenue_sek=54000,
            latest_profit_sek=4200,
            latest_ebitda_sek=6100,
            revenue_cagr_3y=0.09,
            avg_ebitda_margin=0.10,
            avg_net_margin=0.07,
            digital_presence=1,
            company_size_bucket="small",
            growth_bucket="medium",
            profitability_bucket="positive",
        ),
    ]

    conn.executemany(
        """
        INSERT INTO company_metrics (
            orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek,
            revenue_cagr_3y, revenue_cagr_5y, avg_ebitda_margin, avg_net_margin,
            digital_presence, company_size_bucket, growth_bucket, profitability_bucket,
            created_at, updated_at
        ) VALUES (
            :orgnr, :latest_year, :latest_revenue_sek, :latest_profit_sek, :latest_ebitda_sek,
            :revenue_cagr_3y, NULL, :avg_ebitda_margin, :avg_net_margin,
            :digital_presence, :company_size_bucket, :growth_bucket, :profitability_bucket,
            datetime('now'), datetime('now')
        )
        """,
        metrics,
    )

    financials = []
    for company in companies:
        raw_json = {
            "company": {
                "name": company["company_name"],
                "homePage": company["homepage"],
                "visitingAddress": {
                    "street": company["address"]["streetAddress"]["streetName"],
                    "city": company["address"]["streetAddress"]["postPlace"],
                },
            }
        }
        financials.append(
            dict(
                id=f"cf-{company['orgnr']}",
                orgnr=company["orgnr"],
                year=2024,
                period="12",
                raw_json=json.dumps(raw_json),
            )
        )

    conn.executemany(
        """
        INSERT INTO company_financials (id, orgnr, company_id, year, period, raw_json)
        VALUES (:id, :orgnr, NULL, :year, :period, :raw_json)
        """,
        financials,
    )

    account_rows = []
    for orgnr, revenue, profit in [
        ("5560001421", 72000, 6300),
        ("5560002064", 54000, 4200),
    ]:
        for year_offset, multiplier in enumerate([1.0, 0.9, 0.85], start=0):
            year = 2024 - year_offset
            account_rows.extend(
                [
                    dict(
                        id=f"{orgnr}-SDI-{year}",
                        orgnr=orgnr,
                        account_code="SDI",
                        amount_sek=revenue * multiplier,
                        year=year,
                    ),
                    dict(
                        id=f"{orgnr}-RG-{year}",
                        orgnr=orgnr,
                        account_code="RG",
                        amount_sek=revenue * multiplier * 0.15,
                        year=year,
                    ),
                    dict(
                        id=f"{orgnr}-DR-{year}",
                        orgnr=orgnr,
                        account_code="DR",
                        amount_sek=profit * multiplier,
                        year=year,
                    ),
                ]
            )

    conn.executemany(
        """
        INSERT INTO financial_accounts (
            id, financial_id, orgnr, account_code, amount_sek, year, period
        ) VALUES (
            :id, NULL, :orgnr, :account_code, :amount_sek, :year, '12'
        )
        """,
        account_rows,
    )


def main() -> None:
    ensure_dir(DATA_DIR)
    conn = reset_db(DB_PATH)
    try:
        bootstrap_schema(conn)
        insert_sample_data(conn)
        conn.commit()
        print(f"✅ Created lightweight local DB for dashboard tests at {DB_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

