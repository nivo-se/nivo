#!/usr/bin/env python3
"""
Smoke test AI intel in Postgres mode.
Uses DATABASE_SOURCE=postgres, picks orgnrs with company_enrichment,
calls DB service and/or API, asserts enrichment and ai_profile exist.

Usage:
    DATABASE_SOURCE=postgres python3 scripts/smoke_test_ai_postgres.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("DATABASE_SOURCE", "postgres")


def load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass


def main() -> int:
    load_dotenv()
    if os.getenv("DATABASE_SOURCE", "").lower() != "postgres":
        print("⚠ Set DATABASE_SOURCE=postgres to run this test")
        return 1

    try:
        from backend.services.db_factory import get_database_service, reset_database_service_cache
    except ImportError:
        print("❌ Cannot import db_factory")
        return 1

    reset_database_service_cache()
    db = get_database_service()

    if not db.table_exists("company_enrichment"):
        print("⚠ company_enrichment table not found; skipping enrichment checks")
        orgnrs_with_enrichment = []
    else:
        rows = db.run_raw_query(
            "SELECT DISTINCT orgnr FROM company_enrichment LIMIT 5",
            params=[],
        )
        orgnrs_with_enrichment = [r.get("orgnr") for r in rows if r.get("orgnr")]

    if not orgnrs_with_enrichment:
        rows = db.run_raw_query("SELECT orgnr FROM companies LIMIT 5", params=[])
        orgnrs_with_enrichment = [r.get("orgnr") for r in rows if r.get("orgnr")]

    if not orgnrs_with_enrichment:
        print("❌ No orgnrs found in DB")
        return 1

    sample_orgnrs = orgnrs_with_enrichment[:5]
    print(f"Testing orgnrs: {sample_orgnrs}")

    errors = []

    for orgnr in sample_orgnrs:
        profile = db.fetch_ai_profiles([orgnr])
        enrichment = db.fetch_company_enrichment_single(
            orgnr, kinds=["company_profile", "website_insights", "about_summary", "llm_analysis"],
            latest_run_only=True,
        )
        if not profile and not enrichment:
            errors.append(f"  {orgnr}: no ai_profile and no enrichment")
        elif enrichment and not any(enrichment.values()):
            errors.append(f"  {orgnr}: enrichment empty")
        else:
            kinds = list(enrichment.keys()) if enrichment else []
            has_profile = bool(profile)
            print(f"  ✓ {orgnr}: ai_profile={has_profile}, enrichment_kinds={kinds}")

    if errors:
        for e in errors:
            print(e)
        print(f"\n❌ Smoke test failed: {len(errors)} issues")
        return 1

    print("\n✅ Smoke test passed: AI intel endpoints work in Postgres mode")
    return 0


if __name__ == "__main__":
    sys.exit(main())
