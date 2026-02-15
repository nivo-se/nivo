#!/usr/bin/env python3
"""Transform staging SQLite data into the new company schema.

The script can produce:
 1. A local SQLite database (`--local-sqlite`) matching the new schema
 2. CSV exports (`--csv-dir`) for bulk import into Supabase

Example:
  python3 scripts/migrate_staging_to_new_schema.py \
      --source scraper/allabolag-scraper/staging/staging_50_200_combined.db \
      --local-sqlite data/local_company_data.db \
      --csv-dir data/csv_export

`SUPABASE_DB_URL` can be supplied later to load CSVs via psql `COPY`.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sqlite3
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    orgnr TEXT PRIMARY KEY,
    company_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    company_type TEXT,
    homepage TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    segment_names TEXT,
    nace_codes TEXT,
    foundation_year INTEGER,
    employees_latest INTEGER,
    accounts_last_year TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS company_financials (
    id TEXT PRIMARY KEY,
    orgnr TEXT NOT NULL,
    company_id TEXT,
    year INTEGER NOT NULL,
    period TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    currency TEXT,
    revenue_sek REAL,
    profit_sek REAL,
    ebitda_sek REAL,
    equity_sek REAL,
    debt_sek REAL,
    employees INTEGER,
    account_codes TEXT,
    raw_json TEXT NOT NULL,
    scraped_at TEXT,
    source_job_id TEXT
);

CREATE TABLE IF NOT EXISTS company_metrics (
    orgnr TEXT PRIMARY KEY,
    latest_year INTEGER,
    latest_revenue_sek REAL,
    latest_profit_sek REAL,
    latest_ebitda_sek REAL,
    revenue_cagr_3y REAL,
    revenue_cagr_5y REAL,
    avg_ebitda_margin REAL,
    avg_net_margin REAL,
    equity_ratio_latest REAL,
    debt_to_equity_latest REAL,
    revenue_per_employee REAL,
    ebitda_per_employee REAL,
    digital_presence INTEGER,
    company_size_bucket TEXT,
    growth_bucket TEXT,
    profitability_bucket TEXT,
    calculated_at TEXT,
    source_job_id TEXT
);

CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    financial_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    year INTEGER NOT NULL,
    period TEXT NOT NULL,
    account_code TEXT NOT NULL,
    amount_sek REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT fk_financial_accounts_financial
        FOREIGN KEY (financial_id) REFERENCES company_financials(id) ON DELETE CASCADE,
    CONSTRAINT fk_financial_accounts_company
        FOREIGN KEY (orgnr) REFERENCES companies(orgnr) ON DELETE CASCADE,
    CONSTRAINT uq_financial_accounts_code UNIQUE (financial_id, account_code)
);

CREATE INDEX IF NOT EXISTS financial_accounts_orgnr_year_idx
    ON financial_accounts(orgnr, year DESC);

CREATE INDEX IF NOT EXISTS financial_accounts_account_code_idx
    ON financial_accounts(account_code);

CREATE INDEX IF NOT EXISTS financial_accounts_account_code_year_idx
    ON financial_accounts(account_code, year DESC);

CREATE INDEX IF NOT EXISTS financial_accounts_financial_id_idx
    ON financial_accounts(financial_id);

CREATE INDEX IF NOT EXISTS financial_accounts_orgnr_code_year_idx
    ON financial_accounts(orgnr, account_code, year DESC);

CREATE INDEX IF NOT EXISTS financial_accounts_year_period_idx
    ON financial_accounts(year DESC, period);

CREATE VIEW IF NOT EXISTS financial_accounts_pivot AS
SELECT
    fa.orgnr,
    fa.year,
    fa.period,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) AS revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) AS ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) AS profit_sek,
    MAX(CASE WHEN fa.account_code = 'EBITDA' THEN fa.amount_sek END) AS ebitda_sek,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) AS equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) AS debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) AS total_assets_sek,
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) AS employees,
    MAX(CASE WHEN fa.account_code = 'EKA' THEN fa.amount_sek END) AS equity_ratio,
    MAX(CASE WHEN fa.account_code = 'avk_eget_kapital' THEN fa.amount_sek END) AS roe_pct,
    MAX(CASE WHEN fa.account_code = 'avk_totalt_kapital' THEN fa.amount_sek END) AS roa_pct
FROM financial_accounts fa
GROUP BY fa.orgnr, fa.year, fa.period;
"""


def load_staging_data(src: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    conn = sqlite3.connect(src)
    conn.row_factory = sqlite3.Row

    companies = conn.execute(
        """
        SELECT c.*, ids.company_id
        FROM staging_companies c
        LEFT JOIN staging_company_ids ids
          ON ids.orgnr = c.orgnr AND ids.job_id = c.job_id
        """
    ).fetchall()

    financials = conn.execute(
        "SELECT * FROM staging_financials"
    ).fetchall()

    conn.close()
    return [dict(row) for row in companies], [dict(row) for row in financials]


def clean_raw_json(raw_json: str) -> str:
    """Clean raw JSON to keep only essential parts (removes Sentry traces, hydration data, etc.).
    
    This reduces size by ~45% while keeping all useful financial and company data.
    PostgreSQL JSONB will compress it further to ~15% of original size.
    """
    data = json.loads(raw_json)
    page_props = data.get("pageProps", {})
    company = page_props.get("company", {})
    
    # Keep only essential parts: company info, financial accounts, and address data
    essential = {
        "company": {
            "orgnr": company.get("orgnr"),
            "name": company.get("name"),
            "companyId": company.get("companyId"),
            "companyAccounts": company.get("companyAccounts", []),
            "annualReports": company.get("annualReports", []),
            # Include address/location data for city extraction
            "visitorAddress": company.get("visitorAddress"),
            "mainOffice": company.get("mainOffice"),
            "location": company.get("location"),
            "domicile": company.get("domicile"),
            # Also include direct address fields if they exist
            "postPlace": company.get("postPlace"),
            "city": company.get("city"),
            "addressLine": company.get("addressLine"),
        }
    }
    
    return json.dumps(essential, ensure_ascii=False)


def parse_account_codes(raw_json: str, target_year: int, target_period: str) -> Tuple[Dict[str, float], Dict[str, Any]]:
    data = json.loads(raw_json)
    company = data.get("pageProps", {}).get("company", {})
    accounts: List[Dict[str, Any]] = company.get("companyAccounts", [])

    target = None
    for report in accounts:
        year = int(report.get("year") or 0)
        period = str(report.get("period") or "12")
        if year == target_year and period == target_period:
            target = report
            break

    if target is None and accounts:
        target = accounts[0]

    account_codes: Dict[str, float] = {}
    if target:
        for account in target.get("accounts", []):
            code = account.get("code") or account.get("accountCode")
            amount = account.get("amount")
            if code is None or amount in (None, ""):
                continue
            try:
                # Store values as-is in thousands (from Allabolag)
                # Do NOT multiply by 1000 - keep original format
                account_codes[code] = float(amount)
            except ValueError:
                continue

    return account_codes, company


def thousands_to_sek(value: Optional[Any]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value) * 1000.0
    except (TypeError, ValueError):
        return None


def to_int(value: Optional[Any]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def extract_address_from_company_info(company_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract address object from company info dictionary.
    
    Returns a structured address object with:
    - addressLine: Street address
    - postPlace: City name
    - postCode: Postal code
    - city: City name (same as postPlace)
    - county: County/region
    - country: Country (defaults to Sweden)
    """
    if not company_info:
        return None
    
    # Try to get address from visitorAddress, mainOffice, or location
    address_obj = (
        company_info.get("visitorAddress") or
        company_info.get("mainOffice") or
        company_info.get("location") or
        company_info.get("domicile")
    )
    
    if address_obj:
        # Extract all address fields
        result = {
            "addressLine": address_obj.get("addressLine"),
            "postPlace": address_obj.get("postPlace"),
            "postCode": address_obj.get("postCode"),
            "city": address_obj.get("city") or address_obj.get("postPlace"),
            "county": address_obj.get("county"),
            "country": address_obj.get("country") or "Sweden"
        }
        # Only return if we have at least some address data
        if result.get("postPlace") or result.get("city") or result.get("addressLine"):
            return result
    
    # Fallback: check direct fields on company object
    if company_info.get("postPlace") or company_info.get("city") or company_info.get("addressLine"):
        return {
            "addressLine": company_info.get("addressLine"),
            "postPlace": company_info.get("postPlace"),
            "postCode": company_info.get("postCode"),
            "city": company_info.get("city") or company_info.get("postPlace"),
            "county": company_info.get("county"),
            "country": company_info.get("country") or "Sweden"
        }
    
    return None


def build_companies_rows(
    companies: Iterable[Dict[str, Any]], 
    metrics_lookup: Dict[str, Any],
    address_map: Optional[Dict[str, Dict[str, Any]]] = None,
    homepage_map: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    rows = []
    address_map = address_map or {}
    homepage_map = homepage_map or {}
    
    for item in companies:
        orgnr = item["orgnr"]
        segment = item.get("segment_name")
        nace = item.get("nace_categories")
        
        # Get address from map if available
        address_data = address_map.get(orgnr)
        address_json = None
        if address_data:
            address_json = json.dumps(address_data, ensure_ascii=False)
        
        # Get homepage from map if available, otherwise from item
        homepage = homepage_map.get(orgnr) or item.get("homepage")
        # Normalize homepage URL
        if homepage:
            homepage = str(homepage).strip()
            if homepage and not homepage.startswith(("http://", "https://")):
                homepage = f"https://{homepage}"

        rows.append({
            "orgnr": orgnr,
            "company_id": item.get("company_id"),
            "company_name": item.get("company_name"),
            "company_type": "AB",
            "homepage": homepage,
            "email": None,
            "phone": None,
            "address": address_json,
            "segment_names": segment,
            "nace_codes": nace,
            "foundation_year": item.get("foundation_year"),
            "employees_latest": metrics_lookup.get(orgnr, {}).get("employees_latest"),
            "accounts_last_year": item.get("company_accounts_last_year"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        })
    return rows


def compute_metrics(
    financial_rows: List[Dict[str, Any]],
    companies_map: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    by_org: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    employees_latest: Dict[str, int] = {}
    for row in financial_rows:
        by_org[row["orgnr"]].append(row)
        emp_val = to_int(row.get("employees"))
        if emp_val:
            employees_latest[row["orgnr"]] = emp_val

    metrics_rows: List[Dict[str, Any]] = []
    for orgnr, entries in by_org.items():
        entries.sort(key=lambda r: (r["year"], r["period"]))
        latest = entries[-1]
        def cagr(years: int) -> Optional[float]:
            if len(entries) < 2:
                return None
            ref_year = latest["year"] - years
            older = None
            for candidate in entries:
                if candidate["year"] <= ref_year:
                    older = candidate
            if older and older.get("revenue_sek") and latest.get("revenue_sek") and older["revenue_sek"] > 0:
                span = max(1, latest["year"] - older["year"])
                ratio = latest["revenue_sek"] / older["revenue_sek"]
                return math.pow(ratio, 1 / span) - 1
            return None

        def avg_margin(numerator_key: str) -> Optional[float]:
            ratios: List[float] = []
            for entry in entries:
                revenue = entry.get("revenue_sek")
                numerator = entry.get(numerator_key)
                if revenue and numerator is not None:
                    try:
                        revenue_value = float(revenue)
                        numerator_value = float(numerator)
                    except (TypeError, ValueError):
                        continue
                    if revenue_value != 0:
                        ratios.append(numerator_value / revenue_value)
            if not ratios:
                return None
            return sum(ratios) / len(ratios)

        equity = latest.get("equity_sek")
        debt = latest.get("debt_sek")
        equity_ratio = None
        debt_to_equity = None
        if equity is not None and debt is not None:
            total = equity + debt
            if total:
                equity_ratio = equity / total
            if equity:
                debt_to_equity = debt / equity

        employees = to_int(latest.get("employees")) or employees_latest.get(orgnr)
        revenue_per_employee = None
        ebitda_per_employee = None
        if employees and employees > 0 and latest.get("revenue_sek"):
            revenue_per_employee = latest["revenue_sek"] / employees
            if latest.get("ebitda_sek"):
                ebitda_per_employee = latest["ebitda_sek"] / employees

        revenue_latest = latest.get("revenue_sek")
        if revenue_latest is None:
            size_bucket = None
        elif revenue_latest < 50_000_000:
            size_bucket = "small"
        elif revenue_latest < 150_000_000:
            size_bucket = "medium"
        else:
            size_bucket = "large"

        growth = cagr(3)
        if growth is None:
            growth_bucket = None
        elif growth < 0:
            growth_bucket = "declining"
        elif growth < 0.05:
            growth_bucket = "flat"
        elif growth < 0.15:
            growth_bucket = "moderate"
        else:
            growth_bucket = "high"

        avg_net = avg_margin("profit_sek")
        if avg_net is None:
            profitability_bucket = None
        elif avg_net < 0:
            profitability_bucket = "loss-making"
        elif avg_net < 0.05:
            profitability_bucket = "low"
        elif avg_net < 0.15:
            profitability_bucket = "healthy"
        else:
            profitability_bucket = "high"

        # Calculate EBIT margin from RG account code (EBIT) instead of EBITDA
        # RG = Rörelseresultat = EBIT (Operating Result)
        # We need to get RG values from financial_accounts, not from ebitda_sek field
        # For now, calculate from available ebitda_sek if it exists, but note this should be EBIT
        # TODO: In future migrations, extract RG directly from account_codes
        company_row = companies_map.get(orgnr, {})
        metrics_rows.append({
            "orgnr": orgnr,
            "latest_year": latest["year"],
            "latest_revenue_sek": revenue_latest,
            "latest_profit_sek": latest.get("profit_sek"),
            "latest_ebitda_sek": latest.get("ebitda_sek"),  # Note: This may actually be EBIT (RG), not EBITDA
            "revenue_cagr_3y": growth,
            "revenue_cagr_5y": cagr(5),
            # Calculate EBIT margin - using ebitda_sek field which should contain RG (EBIT) values
            # Margin calculation will be fixed post-migration via SQL to use RG account code directly
            "avg_ebitda_margin": avg_margin("ebitda_sek"),  # This is actually EBIT margin, not EBITDA
            "avg_net_margin": avg_net,
            "equity_ratio_latest": equity_ratio,
            "debt_to_equity_latest": debt_to_equity,
            "revenue_per_employee": revenue_per_employee,
            "ebitda_per_employee": ebitda_per_employee,
            "digital_presence": 1 if company_row.get("homepage") else 0,
            "company_size_bucket": size_bucket,
            "growth_bucket": growth_bucket,
            "profitability_bucket": profitability_bucket,
            "calculated_at": datetime.now().isoformat(),
            "source_job_id": latest.get("source_job_id"),
        })

    employees_map = {orgnr: metrics.get("revenue_per_employee") for orgnr, metrics in zip(by_org.keys(), metrics_rows)}
    metrics_lookup = {orgnr: {"employees_latest": employees_latest.get(orgnr)} for orgnr in by_org}
    return metrics_rows, metrics_lookup


def transform(source: Path) -> Tuple[
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
]:
    companies_raw, financials_raw = load_staging_data(source)
    companies_map = {row["orgnr"]: row for row in companies_raw}

    financial_rows: List[Dict[str, Any]] = []
    financial_account_rows: List[Dict[str, Any]] = []
    address_map: Dict[str, Dict[str, Any]] = {}  # Map orgnr -> address data
    homepage_map: Dict[str, str] = {}  # Map orgnr -> homepage URL
    
    for row in financials_raw:
        account_codes, company_info = parse_account_codes(row["raw_data"], int(row["year"]), str(row["period"]))

        # Extract address data from company_info if available
        orgnr = row["orgnr"]
        if orgnr not in address_map:
            address_data = extract_address_from_company_info(company_info)
            if address_data:
                address_map[orgnr] = address_data
        
        # Extract homepage from company_info if available
        if orgnr not in homepage_map:
            homepage = company_info.get("homePage") or company_info.get("homepage")
            if homepage:
                homepage = str(homepage).strip()
                if homepage and not homepage.startswith(("http://", "https://")):
                    homepage = f"https://{homepage}"
                homepage_map[orgnr] = homepage

        # account_codes now contains values in thousands (as-is from Allabolag)
        # Store all values as-is in thousands - do NOT multiply by 1000
        # FIX: Use "EBITDA" account code instead of "ORS" (ORS is "Resultat före skatt", not EBITDA)
        ebitda = account_codes.get("EBITDA")
        equity = account_codes.get("EK")
        debt = account_codes.get("FK")
        employees = to_int(row.get("employees") or company_info.get("employees"))
        financial_id = row.get("id") or str(uuid.uuid4())
        timestamp = datetime.now().isoformat()

        financial_rows.append({
            "id": financial_id,
            "orgnr": row["orgnr"],
            "company_id": row.get("company_id"),
            "year": row["year"],
            "period": row["period"],
            "period_start": row.get("period_start"),
            "period_end": row.get("period_end"),
            "currency": "SEK",
            # revenue and profit come from staging table (in thousands), store as-is
            "revenue_sek": row.get("revenue"),  # Already in thousands, no conversion needed
            "profit_sek": row.get("profit"),    # Already in thousands, no conversion needed
            # ebitda, equity, debt come from account_codes (in thousands), use directly
            "ebitda_sek": ebitda,
            "equity_sek": equity,
            "debt_sek": debt,
            "employees": employees,
            "account_codes": json.dumps(account_codes, ensure_ascii=False),
            "raw_json": clean_raw_json(row["raw_data"]),
            "scraped_at": row.get("scraped_at"),
            "source_job_id": row.get("job_id"),
        })

        for code, amount in account_codes.items():
            financial_account_rows.append({
                "id": str(uuid.uuid4()),
                "financial_id": financial_id,
                "orgnr": row["orgnr"],
                "year": row["year"],
                "period": row["period"],
                "account_code": code,
                "amount_sek": amount,
                "created_at": timestamp,
            })

    metrics_rows, metrics_lookup = compute_metrics(financial_rows, companies_map)
    companies_rows = build_companies_rows(companies_raw, metrics_lookup, address_map, homepage_map)

    return companies_rows, financial_rows, metrics_rows, financial_account_rows


def write_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def populate_sqlite(
    db_path: Path,
    companies_rows: List[Dict[str, Any]],
    financial_rows: List[Dict[str, Any]],
    metrics_rows: List[Dict[str, Any]],
    financial_account_rows: List[Dict[str, Any]],
) -> None:
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.executescript(SQLITE_SCHEMA)

    def insert_many(table: str, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        columns = rows[0].keys()
        placeholders = ",".join(["?"] * len(columns))
        conn.executemany(
            f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
            [tuple(row[col] for col in columns) for row in rows],
        )

    insert_many("companies", companies_rows)
    insert_many("company_financials", financial_rows)
    insert_many("company_metrics", metrics_rows)
    insert_many("financial_accounts", financial_account_rows)
    conn.commit()
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate staging data into new schema")
    parser.add_argument("--source", required=True, help="Combined staging SQLite file")
    parser.add_argument("--local-sqlite", help="Output SQLite db with new schema")
    parser.add_argument("--csv-dir", help="Directory to write CSV exports")
    args = parser.parse_args()

    source = Path(args.source)
    if not source.exists():
        parser.error(f"Source database not found: {source}")

    companies_rows, financial_rows, metrics_rows, financial_account_rows = transform(source)

    if args.local_sqlite:
        populate_sqlite(
            Path(args.local_sqlite),
            companies_rows,
            financial_rows,
            metrics_rows,
            financial_account_rows,
        )
        print(f"Local SQLite dataset written to {args.local_sqlite}")

    if args.csv_dir:
        csv_dir = Path(args.csv_dir)
        write_csv(csv_dir / "companies.csv", companies_rows)
        write_csv(csv_dir / "company_financials.csv", financial_rows)
        write_csv(csv_dir / "company_metrics.csv", metrics_rows)
        write_csv(csv_dir / "financial_accounts.csv", financial_account_rows)
        print(f"CSV exports written to {csv_dir}")


if __name__ == "__main__":
    main()

