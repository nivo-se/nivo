#!/usr/bin/env python3
"""
Migrate data from SQLite (nivo_optimized.db) to local Postgres.

Uses POSTGRES_* env vars for Postgres. Preserves SQLite as fallback.
Tables: companies, financials, company_kpis, ai_profiles (ai_queries, saved_company_lists if present).

Usage:
    python3 scripts/migrate_sqlite_to_postgres.py [--truncate] [--sqlite path]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

TARGET_TABLES = [
    "companies",
    "financials",
    "company_kpis",
    "ai_profiles",
    "ai_queries",
    "saved_company_lists",
]

TABLE_MAP = {"company_metrics": "company_kpis"}
BATCH_SIZE = 5000


def load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass


def _to_jsonb(val):
    if val is None or val == "":
        return None
    if isinstance(val, (dict, list)):
        return val
    s = str(val).strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return {"raw": s}


def _ts(v):
    if not v:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


def _safe_int(v):
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _prepare_companies_row(row: dict) -> tuple:
    address_parts = {}
    if row.get("address"):
        address_parts["street"] = row["address"]
    if row.get("city"):
        address_parts["city"] = row["city"]
    if row.get("postal_code"):
        address_parts["postal_code"] = row["postal_code"]
    if row.get("country"):
        address_parts["country"] = row["country"]
    address_json = json.dumps(address_parts) if address_parts else None
    segment_names = _to_jsonb(row.get("segment_names"))
    nace_codes = _to_jsonb(row.get("nace_categories") or row.get("nace_codes"))
    return (
        row.get("orgnr"),
        row.get("company_id"),
        row.get("company_name"),
        None,
        row.get("homepage"),
        row.get("email"),
        row.get("phone"),
        address_json,
        json.dumps(segment_names) if segment_names is not None else None,
        json.dumps(nace_codes) if nace_codes is not None else None,
        json.dumps(nace_codes) if nace_codes is not None else None,  # nace_categories = nace_codes
        _safe_int(row.get("foundation_year")),
        _safe_int(row.get("employees_latest")),
        None,
        _ts(row.get("scraped_at") or row.get("updated_at")),
        _ts(row.get("updated_at")),
    )


def _prepare_financials_row(row: dict) -> tuple:
    main_cols = {"si_sek", "sdi_sek", "dr_sek", "resultat_e_avskrivningar_sek", "ebitda_sek", "ors_sek"}
    account_codes = {}
    for k, v in row.items():
        if k.endswith("_sek") and k not in main_cols and v is not None:
            try:
                account_codes[k] = float(v)
            except (TypeError, ValueError):
                account_codes[k] = v
    ac_json = json.dumps(account_codes) if account_codes else None
    return (
        row.get("orgnr"),
        row.get("company_id"),
        row.get("year"),
        row.get("period") or "12",
        row.get("period_start"),
        row.get("period_end"),
        row.get("currency") or "SEK",
        _safe_int(row.get("employees")),
        row.get("si_sek"),
        row.get("sdi_sek"),
        row.get("dr_sek"),
        row.get("resultat_e_avskrivningar_sek"),
        row.get("ebitda_sek"),
        row.get("ors_sek"),
        ac_json,
        _ts(row.get("scraped_at") or row.get("created_at")),
        _ts(row.get("created_at")),
    )


def _prepare_company_kpis_row(row: dict) -> tuple:
    return (
        row.get("orgnr"),
        row.get("latest_year"),
        row.get("latest_revenue_sek"),
        row.get("latest_profit_sek"),
        row.get("latest_ebit_sek"),
        row.get("latest_ebitda_sek"),
        row.get("revenue_cagr_3y"),
        row.get("revenue_cagr_5y"),
        row.get("revenue_growth_yoy"),
        row.get("avg_ebitda_margin"),
        row.get("avg_net_margin"),
        row.get("avg_ebit_margin"),
        row.get("equity_ratio") or row.get("equity_ratio_latest"),
        row.get("debt_to_equity") or row.get("debt_to_equity_latest"),
        row.get("revenue_per_employee"),
        row.get("ebitda_per_employee"),
        row.get("company_size_bucket"),
        row.get("growth_bucket"),
        row.get("profitability_bucket"),
        _ts(row.get("calculated_at") or row.get("updated_at")),
        _ts(row.get("updated_at") or row.get("calculated_at")),
    )


def _prepare_ai_profiles_row(row: dict) -> tuple:
    mr = _to_jsonb(row.get("market_regions"))
    rf = _to_jsonb(row.get("risk_flags"))
    ns = _to_jsonb(row.get("next_steps"))
    sp = _to_jsonb(row.get("scraped_pages"))
    return (
        row.get("org_number"),
        row.get("website"),
        row.get("product_description"),
        row.get("end_market"),
        row.get("customer_types"),
        row.get("value_chain_position"),
        row.get("business_model_summary"),
        None,
        row.get("industry_sector"),
        row.get("industry_subsector"),
        json.dumps(mr) if mr is not None else None,
        None,
        row.get("strategic_fit_score"),
        row.get("defensibility_score"),
        json.dumps(rf) if rf is not None else None,
        row.get("upside_potential"),
        None,
        row.get("fit_rationale"),
        row.get("strategic_playbook"),
        json.dumps(ns) if ns is not None else None,
        row.get("ai_notes"),
        row.get("agent_type"),
        json.dumps(sp) if sp is not None else None,
        row.get("enrichment_status") or "complete",
        _ts(row.get("last_updated")),
        row.get("date_scraped") and _ts(row.get("date_scraped")),
        _ts(row.get("last_updated")),
    )


PREPARE = {
    "companies": _prepare_companies_row,
    "financials": _prepare_financials_row,
    "company_kpis": _prepare_company_kpis_row,
    "company_metrics": _prepare_company_kpis_row,
    "ai_profiles": _prepare_ai_profiles_row,
}

INSERT_COLS = {
    "companies": (
        "orgnr", "company_id", "company_name", "company_type", "homepage", "email", "phone",
        "address", "segment_names", "nace_codes", "nace_categories", "foundation_year", "employees_latest",
        "accounts_last_year", "created_at", "updated_at",
    ),
    "financials": (
        "orgnr", "company_id", "year", "period", "period_start", "period_end", "currency",
        "employees", "si_sek", "sdi_sek", "dr_sek", "resultat_e_avskrivningar_sek",
        "ebitda_sek", "ors_sek", "account_codes", "scraped_at", "created_at",
    ),
    "company_kpis": (
        "orgnr", "latest_year", "latest_revenue_sek", "latest_profit_sek",
        "latest_ebit_sek", "latest_ebitda_sek", "revenue_cagr_3y", "revenue_cagr_5y",
        "revenue_growth_yoy", "avg_ebitda_margin", "avg_net_margin", "avg_ebit_margin",
        "equity_ratio_latest", "debt_to_equity_latest", "revenue_per_employee",
        "ebitda_per_employee", "company_size_bucket", "growth_bucket", "profitability_bucket",
        "calculated_at", "updated_at",
    ),
    "ai_profiles": (
        "org_number", "website", "product_description", "end_market", "customer_types",
        "value_chain_position", "business_model_summary", "business_summary",
        "industry_sector", "industry_subsector", "market_regions", "industry_keywords",
        "strategic_fit_score", "defensibility_score", "risk_flags", "upside_potential",
        "acquisition_angle", "fit_rationale", "strategic_playbook", "next_steps",
        "ai_notes", "agent_type", "scraped_pages", "enrichment_status", "last_updated",
        "date_scraped", "created_at",
    ),
}


def migrate_table(sqlite_conn, pg_conn, sqlite_table: str, pg_table: str, truncate: bool, counts: dict) -> int:
    if pg_table not in INSERT_COLS:
        return 0
    prepare_fn = PREPARE.get(sqlite_table) or PREPARE.get(pg_table)
    if not prepare_fn:
        return 0

    cols = INSERT_COLS[pg_table]
    placeholders = ", ".join("%s" for _ in cols)
    col_list = ", ".join(cols)
    insert_sql = f"INSERT INTO {pg_table} ({col_list}) VALUES ({placeholders})"

    if truncate:
        with pg_conn.cursor() as cur:
            cur.execute(f"TRUNCATE TABLE {pg_table} CASCADE")
            pg_conn.commit()

    cur_sqlite = sqlite_conn.execute(f"SELECT * FROM {sqlite_table}")
    cols_sqlite = [d[0] for d in cur_sqlite.description]
    rows_sqlite = cur_sqlite.fetchall()
    if not rows_sqlite:
        counts[pg_table] = 0
        return 0

    row_dicts = [dict(zip(cols_sqlite, r)) for r in rows_sqlite]
    try:
        prepared = [prepare_fn(d) for d in row_dicts]
    except Exception as e:
        print(f"  ⚠ Prepare failed for {sqlite_table}: {e}")
        counts[pg_table] = 0
        return 0

    n = 0
    with pg_conn.cursor() as cur:
        for i in range(0, len(prepared), BATCH_SIZE):
            batch = prepared[i : i + BATCH_SIZE]
            try:
                cur.executemany(insert_sql, batch)
                n += len(batch)
            except Exception as e:
                pg_conn.rollback()
                print(f"  ⚠ Insert failed for {pg_table}: {e}")
                break
        pg_conn.commit()
    counts[pg_table] = n
    return n


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Migrate SQLite to Postgres")
    parser.add_argument("--sqlite", default=str(REPO_ROOT / "data" / "nivo_optimized.db"), help="Path to SQLite database")
    parser.add_argument("--truncate", action="store_true", help="Truncate Postgres tables before import")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        print(f"❌ SQLite not found: {sqlite_path}")
        return 1

    try:
        import sqlite3
        import psycopg2
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        return 1

    pg_kw = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5433")),
        "dbname": os.getenv("POSTGRES_DB", "nivo"),
        "user": os.getenv("POSTGRES_USER", "nivo"),
        "password": os.getenv("POSTGRES_PASSWORD", "nivo"),
    }
    print(f"Postgres: {pg_kw['host']}:{pg_kw['port']}/{pg_kw['dbname']}")
    print(f"SQLite:   {sqlite_path}")

    try:
        pg_conn = psycopg2.connect(**pg_kw)
    except Exception as e:
        print(f"❌ Postgres connection failed: {e}")
        print("   Run: docker compose up -d && python3 scripts/bootstrap_postgres_schema.py")
        return 1

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    cur = sqlite_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables_in_sqlite = {r[0] for r in cur.fetchall()}

    counts = {}
    migrations = []
    for pg_table in ["companies", "financials", "company_kpis", "ai_profiles"]:
        sqlite_table = pg_table if pg_table in tables_in_sqlite else ("company_metrics" if pg_table == "company_kpis" and "company_metrics" in tables_in_sqlite else None)
        if sqlite_table and pg_table in INSERT_COLS:
            migrations.append((sqlite_table, pg_table))

    for sqlite_table, pg_table in migrations:
        n = migrate_table(sqlite_conn, pg_conn, sqlite_table, pg_table, args.truncate, counts)
        print(f"  {pg_table}: {n} rows")

    sqlite_conn.close()
    pg_conn.close()
    print("\n✅ Migration complete")
    for t, c in sorted(counts.items()):
        print(f"   {t}: {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
