#!/usr/bin/env python3
"""
Preview canonical AI summary for an orgnr.
Fetches via DatabaseService and prints build_ai_summary output.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
os.environ.setdefault("DATABASE_SOURCE", "postgres")

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

from backend.services.db_factory import get_database_service
from backend.services.ai_summary_service import build_ai_summary


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--orgnr", required=True, help="Organization number")
    args = parser.parse_args()

    db = get_database_service()
    profiles = db.fetch_ai_profiles([args.orgnr])
    ai_profile = profiles[0] if profiles else None
    enrichment_by_kind = db.fetch_company_enrichment_single(
        args.orgnr,
        kinds=["company_profile", "website_insights", "about_summary", "llm_analysis"],
        latest_run_only=True,
    )
    enrichment = {k: v.get("result") for k, v in enrichment_by_kind.items() if v.get("result")}

    summary = build_ai_summary(args.orgnr, ai_profile, enrichment)
    print(json.dumps(summary, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
