#!/usr/bin/env python3
"""
Import AI-enriched data from donor nivo-v2 SQLite into this repo's Postgres.

Imports ONLY AI/enrichment-related tables. Does NOT overwrite companies, financials,
or company_kpis. Uses upsert by default to avoid duplicates.

Usage:
    python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/nivo-v2/db.sqlite
    python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/db.sqlite --dry-run
    python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/db.sqlite --no-upsert
    python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/db.sqlite --no-create-run
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

BATCH_SIZE = 1000

# Donor column names that map to org_number
ORGNR_ALIASES = ("org_number", "orgnr", "organization_number", "org_num")


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


def _get_orgnr(row: dict) -> str | None:
    for alias in ORGNR_ALIASES:
        v = row.get(alias)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def _prepare_ai_profile(row: dict) -> dict | None:
    """Build row for ai_profiles. Returns None if orgnr missing."""
    org = _get_orgnr(row)
    if not org:
        return None
    mr = _to_jsonb(row.get("market_regions"))
    rf = _to_jsonb(row.get("risk_flags"))
    ns = _to_jsonb(row.get("next_steps"))
    sp = _to_jsonb(row.get("scraped_pages"))
    ik = _to_jsonb(row.get("industry_keywords"))
    return {
        "org_number": org,
        "website": row.get("website") or None,
        "product_description": row.get("product_description") or None,
        "end_market": row.get("end_market") or None,
        "customer_types": row.get("customer_types") or None,
        "value_chain_position": row.get("value_chain_position") or None,
        "business_model_summary": row.get("business_model_summary") or None,
        "business_summary": row.get("business_summary") or None,
        "industry_sector": row.get("industry_sector") or None,
        "industry_subsector": row.get("industry_subsector") or None,
        "market_regions": json.dumps(mr) if mr is not None else None,
        "industry_keywords": json.dumps(ik) if ik is not None else None,
        "strategic_fit_score": _safe_int(row.get("strategic_fit_score")),
        "defensibility_score": _safe_int(row.get("defensibility_score")),
        "risk_flags": json.dumps(rf) if rf is not None else None,
        "upside_potential": row.get("upside_potential") or None,
        "acquisition_angle": row.get("acquisition_angle") or None,
        "fit_rationale": row.get("fit_rationale") or None,
        "strategic_playbook": row.get("strategic_playbook") or None,
        "next_steps": json.dumps(ns) if ns is not None else None,
        "ai_notes": row.get("ai_notes") or None,
        "agent_type": row.get("agent_type") or None,
        "scraped_pages": json.dumps(sp) if sp is not None else None,
        "enrichment_status": row.get("enrichment_status") or "complete",
        "last_updated": _ts(row.get("last_updated")),
        "date_scraped": _ts(row.get("date_scraped")) if row.get("date_scraped") else None,
        "created_at": _ts(row.get("created_at") or row.get("last_updated")),
    }


AI_PROFILES_COLS = (
    "org_number", "website", "product_description", "end_market", "customer_types",
    "value_chain_position", "business_model_summary", "business_summary",
    "industry_sector", "industry_subsector", "market_regions", "industry_keywords",
    "strategic_fit_score", "defensibility_score", "risk_flags", "upside_potential",
    "acquisition_angle", "fit_rationale", "strategic_playbook", "next_steps",
    "ai_notes", "agent_type", "scraped_pages", "enrichment_status", "last_updated",
    "date_scraped", "created_at",
)


def create_import_run(pg_conn, source: str = "nivo-v2-import", dry_run: bool = False) -> str | None:
    """Create enrichment_runs row and return run_id (UUID string). Returns None if dry_run or failed."""
    if dry_run:
        return None
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.enrichment_runs (source, meta)
            VALUES (%s, %s)
            RETURNING id
            """,
            (source, '{"migration": "v2_ai_import"}'),
        )
        row = cur.fetchone()
        pg_conn.commit()
        return str(row[0]) if row else None


def migrate_ai_profiles(
    sqlite_conn,
    pg_conn,
    donor_table: str,
    dry_run: bool,
    upsert: bool,
    valid_orgnrs: set[str] | None = None,
) -> int:
    cur = sqlite_conn.execute(f"SELECT * FROM [{donor_table}]")
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    row_dicts = [dict(zip(cols, r)) for r in rows]
    prepared = []
    for d in row_dicts:
        p = _prepare_ai_profile(d)
        if p:
            if valid_orgnrs is None or p["org_number"] in valid_orgnrs:
                prepared.append(p)
    skipped = len(row_dicts) - len(prepared)
    if skipped:
        print(f"    Skipped {skipped} rows (missing orgnr)")
    if not prepared:
        return 0
    if dry_run:
        print(f"    Would upsert {len(prepared)} rows to ai_profiles")
        return len(prepared)
    placeholders = ", ".join("%s" for _ in AI_PROFILES_COLS)
    col_list = ", ".join(AI_PROFILES_COLS)
    values_tuple = tuple(AI_PROFILES_COLS)
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in AI_PROFILES_COLS if c != "org_number")
    insert_sql = f"""
        INSERT INTO public.ai_profiles ({col_list})
        VALUES ({placeholders})
    """
    if upsert:
        insert_sql += f"""
        ON CONFLICT (org_number) DO UPDATE SET {set_clause}
        """
    val_list = [tuple(p[c] for c in AI_PROFILES_COLS) for p in prepared]
    n = 0
    with pg_conn.cursor() as cur:
        for i in range(0, len(val_list), BATCH_SIZE):
            batch = val_list[i : i + BATCH_SIZE]
            cur.executemany(insert_sql, batch)
            n += len(batch)
        pg_conn.commit()
    return n


def migrate_table_to_company_enrichment(
    sqlite_conn,
    pg_conn,
    donor_table: str,
    kind: str,
    dry_run: bool,
    valid_orgnrs: set[str] | None,
    run_id: str | None,
    result_col_hint: str | None = None,
) -> int:
    """Import a donor table into company_enrichment. result_col_hint: column for result, or None for full row."""
    cur = sqlite_conn.execute(f"SELECT * FROM [{donor_table}]")
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    row_dicts = [dict(zip(cols, r)) for r in rows]
    orgnr_col = next((c for c in cols if c.lower() in ("orgnr", "org_number", "organization_number")), None)
    if not orgnr_col:
        return 0
    prepared = []
    for d in row_dicts:
        org = d.get(orgnr_col)
        if not org:
            continue
        org = str(org).strip()
        if valid_orgnrs is not None and org not in valid_orgnrs:
            continue
        if result_col_hint and result_col_hint in d:
            raw = d.get(result_col_hint)
            if isinstance(raw, str):
                try:
                    res = json.loads(raw)
                except json.JSONDecodeError:
                    res = {"raw": raw}
            else:
                res = raw if raw is not None else {}
            result_val = json.dumps(res) if not isinstance(res, str) else (res or "{}")
        else:
            exclude = {orgnr_col, "updated_at", "created_at", "content_hash", "insight_hash"}
            res = {k: v for k, v in d.items() if k not in exclude and v is not None}
            for k, v in list(res.items()):
                if isinstance(v, str) and v.startswith(("{", "[")):
                    try:
                        res[k] = json.loads(v)
                    except json.JSONDecodeError:
                        pass
            result_val = json.dumps(res) if res else "{}"
        score = d.get("score") or d.get("confidence")
        if score is not None:
            try:
                score = float(score)
            except (TypeError, ValueError):
                score = None
        tags = _to_jsonb(d.get("tags"))
        tags_json = json.dumps(tags) if tags is not None else None
        prepared.append((org, run_id, kind, result_val, score, tags_json, _ts(d.get("updated_at") or d.get("created_at"))))
    if not prepared:
        return 0
    if dry_run:
        return len(prepared)
    if not run_id:
        return 0
    insert_sql = """
        INSERT INTO public.company_enrichment (orgnr, run_id, kind, result, score, tags, created_at)
        VALUES (%s, %s, %s, %s::jsonb, %s, %s::jsonb, COALESCE(%s, NOW()))
        ON CONFLICT (orgnr, run_id, kind) DO UPDATE SET result = EXCLUDED.result, score = EXCLUDED.score
    """
    with pg_conn.cursor() as cur:
        for i in range(0, len(prepared), BATCH_SIZE):
            cur.executemany(insert_sql, prepared[i : i + BATCH_SIZE])
        pg_conn.commit()
    return len(prepared)


def migrate_company_enrichment(
    sqlite_conn,
    pg_conn,
    donor_table: str,
    dry_run: bool,
    valid_orgnrs: set[str] | None,
    run_id: str | None,
    kind: str = "v2_import",
) -> int:
    cur = sqlite_conn.execute(f"SELECT * FROM [{donor_table}]")
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    row_dicts = [dict(zip(cols, r)) for r in rows]
    orgnr_col = next((c for c in cols if c.lower() in ("orgnr", "org_number", "organization_number")), None)
    if not orgnr_col:
        print(f"    No orgnr column in {donor_table}, skipping")
        return 0
    result_col = next((c for c in cols if "result" in c.lower() or "data" in c.lower()), None) or cols[-1]
    prepared = []
    for d in row_dicts:
        org = d.get(orgnr_col)
        if not org:
            continue
        org = str(org).strip()
        if valid_orgnrs is not None and org not in valid_orgnrs:
            continue
        res = d.get(result_col)
        if isinstance(res, str):
            try:
                res = json.loads(res)
            except json.JSONDecodeError:
                res = {"raw": res}
        res_json = json.dumps(res) if res is not None else "{}"
        score = d.get("score")
        if score is not None:
            try:
                score = float(score)
            except (TypeError, ValueError):
                score = None
        tags = _to_jsonb(d.get("tags"))
        tags_json = json.dumps(tags) if tags is not None else None
        result_val = res_json or "{}"
        prepared.append((org, run_id, kind, result_val, score, tags_json, _ts(d.get("created_at"))))
    if not prepared:
        return 0
    if dry_run:
        print(f"    Would insert {len(prepared)} rows to company_enrichment (kind={kind})")
        return len(prepared)
    if not run_id:
        print("    Skipping company_enrichment: run_id required (use --create-run)")
        return 0
    insert_sql = """
        INSERT INTO public.company_enrichment (orgnr, run_id, kind, result, score, tags, created_at)
        VALUES (%s, %s, %s, %s::jsonb, %s, %s::jsonb, COALESCE(%s, NOW()))
        ON CONFLICT (orgnr, run_id, kind) DO UPDATE SET result = EXCLUDED.result, score = EXCLUDED.score
    """
    # company_enrichment has no UNIQUE, so we always insert
    with pg_conn.cursor() as cur:
        for i in range(0, len(prepared), BATCH_SIZE):
            batch = prepared[i : i + BATCH_SIZE]
            cur.executemany(insert_sql, batch)
        pg_conn.commit()
    return len(prepared)


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Import V2 AI data into Postgres")
    parser.add_argument("--sqlite-path", required=True, type=Path, help="Path to donor nivo-v2 SQLite DB")
    parser.add_argument("--dry-run", action="store_true", help="Print planned actions only")
    parser.add_argument("--upsert", default=True, action="store_true", help="Upsert ai_profiles (default)")
    parser.add_argument("--no-upsert", dest="upsert", action="store_false", help="Insert only, fail on conflict")
    parser.add_argument("--create-run", default=True, dest="create_run", action="store_true",
                        help="Create enrichment_runs row and use run_id for company_enrichment (default)")
    parser.add_argument("--no-create-run", dest="create_run", action="store_false",
                        help="Do not create run; company_enrichment will be skipped")
    args = parser.parse_args()

    sqlite_path = args.sqlite_path
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
    if args.dry_run:
        print("Mode: DRY RUN")

    try:
        pg_conn = psycopg2.connect(**pg_kw)
    except Exception as e:
        print(f"❌ Postgres connection failed: {e}")
        return 1

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    cur = sqlite_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    donor_tables = {r[0] for r in cur.fetchall()}

    with pg_conn.cursor() as cur:
        cur.execute("SELECT orgnr FROM public.companies")
        valid_orgnrs = {r[0] for r in cur.fetchall()}

    run_id = None
    if args.create_run and not args.dry_run:
        run_id = create_import_run(pg_conn, source="nivo-v2-import", dry_run=False)
        if run_id:
            print(f"  enrichment_runs: created run {run_id}")

    counts = {}

    # 1. ai_profiles (only for orgnrs in companies – FK)
    if "ai_profiles" in donor_tables:
        n = migrate_ai_profiles(
            sqlite_conn, pg_conn, "ai_profiles", args.dry_run, args.upsert, valid_orgnrs
        )
        counts["ai_profiles"] = n
        print(f"  ai_profiles: {n} rows")
    else:
        print("  ai_profiles: not found in donor, skipping")

    # 2. company_enrichment (generic donor table)
    if "company_enrichment" in donor_tables:
        n = migrate_company_enrichment(
            sqlite_conn, pg_conn, "company_enrichment", args.dry_run, valid_orgnrs,
            run_id=run_id, kind="v2_import",
        )
        counts["company_enrichment"] = n
        print(f"  company_enrichment: {n} rows")

    # 3. nivo-v2 specific tables → company_enrichment
    V2_ENRICHMENT_TABLES = [
        ("clean_llm_analysis", "llm_analysis", "analysis_json"),
        ("company_profile", "company_profile", None),  # full row as result
        ("company_website_extracts", "about_summary", None),  # full row as result
        ("company_website_insights", "website_insights", "insights_json"),
    ]
    for donor_table, kind, result_col_hint in V2_ENRICHMENT_TABLES:
        if donor_table not in donor_tables:
            continue
        n = migrate_table_to_company_enrichment(
            sqlite_conn, pg_conn, donor_table, kind, args.dry_run, valid_orgnrs,
            run_id=run_id, result_col_hint=result_col_hint,
        )
        if n > 0:
            counts[f"{donor_table}→company_enrichment"] = n
            print(f"  {donor_table}: {n} rows → company_enrichment (kind={kind})")

    sqlite_conn.close()
    pg_conn.close()

    print("\n✅ Import complete" if not args.dry_run else "\n✅ Dry run complete")
    for t, c in sorted(counts.items()):
        print(f"   {t}: {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
