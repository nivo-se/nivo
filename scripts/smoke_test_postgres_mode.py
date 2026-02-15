#!/usr/bin/env python3
"""
Smoke test for DATABASE_SOURCE=postgres mode.

Sets env and exercises a small set of DB methods.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))


def load_dotenv():
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass


def main() -> int:
    os.environ["DATABASE_SOURCE"] = "postgres"
    load_dotenv()

    print("Smoke test: DATABASE_SOURCE=postgres")
    print("-" * 40)

    try:
        from backend.services.db_factory import get_database_service, reset_database_service_cache
        reset_database_service_cache()
        db = get_database_service()
    except Exception as e:
        print(f"FAIL: get_database_service: {e}")
        return 1

    print(f"  DB service: {type(db).__name__}")

    try:
        rows = db.run_raw_query("SELECT COUNT(*) as cnt FROM companies")
        count = rows[0]["cnt"] if rows else 0
        print(f"  companies count: {count}")
    except Exception as e:
        print(f"  FAIL: companies count: {e}")
        return 1

    try:
        sample = db.run_raw_query("SELECT orgnr FROM companies LIMIT 1")
        orgnr = sample[0]["orgnr"] if sample else None
        if orgnr:
            fin = db.fetch_company_financials(orgnr, limit_years=3)
            print(f"  sample orgnr {orgnr}: {len(fin)} financial rows")
        else:
            print("  (no companies)")
    except Exception as e:
        print(f"  FAIL: sample financials: {e}")
        return 1

    try:
        from backend.api.dependencies import get_supabase_client
        supabase = get_supabase_client()
        if supabase is None:
            print("  supabase client: None (expected when DATABASE_SOURCE=postgres)")
        else:
            print("  WARN: supabase client initialized (should be None)")
    except ImportError:
        print("  supabase check: skipped (backend deps not fully installed)")
    except Exception as e:
        print(f"  supabase check: {e}")

    print("-" * 40)
    print("OK: smoke test passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
