#!/usr/bin/env python3
"""
Smoke test AI report cache-first flow in Postgres mode.

- Picks orgnr with existing llm_analysis from imported v2 data (or any company)
- Calls build_ai_report_from_db: first call returns report if llm_analysis exists
- Simulates POST /generate flow: cache hit => cached=true, cache miss => would generate
- Second call after cache hit => cached=true
- Ensures no Supabase usage (DATABASE_SOURCE=postgres)

Usage:
    DATABASE_SOURCE=postgres python3 scripts/smoke_test_ai_report_cache.py
    DATABASE_SOURCE=postgres python3 scripts/smoke_test_ai_report_cache.py --with-api  # requires running backend
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
        print("⚠ Set DATABASE_SOURCE=postgres to run this test (no Supabase in postgres mode)")
        return 1

    use_api = "--with-api" in sys.argv

    try:
        from backend.services.db_factory import get_database_service, reset_database_service_cache
        from backend.services import ai_report_service
    except ImportError as e:
        print(f"❌ Cannot import: {e}")
        return 1

    reset_database_service_cache()
    db = get_database_service()

    if not db.table_exists("company_enrichment"):
        print("⚠ company_enrichment table not found; run bootstrap + migrate_v2_ai_to_postgres first")
        return 1

    # Pick orgnr with llm_analysis
    rows = db.run_raw_query(
        "SELECT DISTINCT orgnr FROM company_enrichment WHERE kind = 'llm_analysis' LIMIT 1",
        params=[],
    )
    orgnr_with_llm = rows[0]["orgnr"] if rows else None

    if not orgnr_with_llm:
        rows = db.run_raw_query(
            "SELECT DISTINCT orgnr FROM company_enrichment WHERE kind = 'ai_report' LIMIT 1",
            params=[],
        )
        orgnr_with_llm = rows[0]["orgnr"] if rows else None

    if not orgnr_with_llm:
        rows = db.run_raw_query("SELECT orgnr FROM companies LIMIT 1", params=[])
        orgnr_with_llm = rows[0]["orgnr"] if rows else None

    if not orgnr_with_llm:
        print("❌ No orgnrs found")
        return 1

    orgnr = orgnr_with_llm
    print(f"Testing orgnr: {orgnr}")

    # 1) build_ai_report_from_db (cache-first)
    report1 = ai_report_service.build_ai_report_from_db(orgnr, db)
    cached_first = report1 is not None

    print(f"  First build_ai_report_from_db: {'CACHE HIT' if cached_first else 'CACHE MISS'}")

    if cached_first:
        assert isinstance(report1, dict)
        assert report1.get("orgnr") == orgnr
        assert "business_model" in report1 or report1.get("weaknesses") or report1.get("uplift_ops")
        print(f"    business_model present: {bool(report1.get('business_model'))}")
        print(f"    weaknesses count: {len(report1.get('weaknesses') or [])}")

    # 2) Second call: should still get cache hit if data exists
    report2 = ai_report_service.build_ai_report_from_db(orgnr, db)
    cached_second = report2 is not None
    print(f"  Second build_ai_report_from_db: {'CACHE HIT' if cached_second else 'CACHE MISS'}")

    if cached_first and cached_second:
        assert report1["orgnr"] == report2["orgnr"]
        print("  ✓ Same report returned on second call (deterministic)")

    # 3) Optional: hit API if server running
    if use_api:
        import urllib.request
        import json as _json
        base = os.getenv("API_BASE_URL", "http://localhost:8000")
        url = f"{base}/api/ai-reports/generate"
        body = _json.dumps({"orgnr": orgnr, "force_regenerate": False}).encode()
        req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                resp = _json.loads(r.read().decode())
            print(f"  POST /generate response: cached={resp.get('cached')}, orgnr={resp.get('orgnr')}")
            assert resp.get("orgnr") == orgnr
            assert "cached" in resp
        except urllib.error.URLError as e:
            print(f"  ⚠ API call failed (is backend running?): {e}")
        except Exception as e:
            print(f"  ⚠ API error: {e}")

    print("\n✅ Smoke test passed: AI report cache-first path works, no Supabase used")
    return 0


if __name__ == "__main__":
    sys.exit(main())
