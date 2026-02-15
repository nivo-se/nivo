#!/usr/bin/env python3
"""
Validate V2 AI import: compare row counts and sample orgnrs to verify
ai_profiles/company_enrichment rows exist in Postgres.

Usage:
    python3 scripts/validate_v2_ai_import.py [--sqlite-path /path/to/donor.db]
    python3 scripts/validate_v2_ai_import.py

Without --sqlite-path, only validates Postgres state (row counts, sample orgnrs).
With --sqlite-path, compares donor vs Postgres and reports missing orgnrs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

SAMPLE_SIZE = 20


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
    parser = argparse.ArgumentParser(description="Validate V2 AI import")
    parser.add_argument(
        "--sqlite-path",
        type=Path,
        default=None,
        help="Path to donor SQLite (optional; for comparison)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=SAMPLE_SIZE,
        help=f"Number of orgnrs to sample (default {SAMPLE_SIZE})",
    )
    args = parser.parse_args()

    try:
        import psycopg2
        import sqlite3
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

    try:
        pg_conn = psycopg2.connect(**pg_kw)
    except Exception as e:
        print(f"❌ Postgres connection failed: {e}")
        return 1

    report = {
        "postgres": {},
        "donor": {},
        "sample_orgnrs": [],
        "missing_in_postgres": [],
        "present_in_postgres": [],
    }

    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM public.ai_profiles")
        report["postgres"]["ai_profiles"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM public.companies")
        report["postgres"]["companies"] = cur.fetchone()[0]
        try:
            cur.execute("SELECT COUNT(*) FROM public.company_enrichment")
            report["postgres"]["company_enrichment"] = cur.fetchone()[0]
        except Exception:
            pg_conn.rollback()
            report["postgres"]["company_enrichment"] = 0

        # Sample orgnrs from ai_profiles (these are the ones we expect to have enrichment)
        cur.execute(
            "SELECT org_number FROM public.ai_profiles ORDER BY RANDOM() LIMIT %s",
            (args.sample_size,),
        )
        report["sample_orgnrs"] = [r[0] for r in cur.fetchall()]

    donor_orgnrs = []
    if args.sqlite_path and args.sqlite_path.exists():
        sqlite_conn = sqlite3.connect(args.sqlite_path)
        cur = sqlite_conn.execute("SELECT COUNT(*) FROM ai_profiles")
        report["donor"]["ai_profiles"] = cur.fetchone()[0]
        try:
            cur = sqlite_conn.execute("SELECT COUNT(*) FROM company_enrichment")
            report["donor"]["company_enrichment"] = cur.fetchone()[0]
        except Exception:
            report["donor"]["company_enrichment"] = 0
        # Get orgnrs from donor ai_profiles (check org_number, orgnr, organization_number)
        cur = sqlite_conn.execute("PRAGMA table_info(ai_profiles)")
        cols = [r[1].lower() for r in cur.fetchall()]
        orgnr_col = next(
            (c for c in ["org_number", "orgnr", "organization_number"] if c in cols),
            None,
        )
        if orgnr_col:
            cur = sqlite_conn.execute(f"SELECT {orgnr_col} FROM ai_profiles")
            donor_orgnrs = [str(r[0]).strip() for r in cur.fetchall() if r[0]]
        sqlite_conn.close()

    # Sample: from donor if provided, else from Postgres ai_profiles
    if donor_orgnrs:
        import random
        sample_orgnrs = random.sample(
            donor_orgnrs, min(args.sample_size, len(donor_orgnrs))
        )
    else:
        sample_orgnrs = report["sample_orgnrs"]
    report["sample_orgnrs"] = sample_orgnrs

    # Re-check presence for the chosen sample
    report["present_in_postgres"] = []
    report["missing_in_postgres"] = []
    if sample_orgnrs:
        with pg_conn.cursor() as cur:
            for orgnr in sample_orgnrs:
                cur.execute(
                    "SELECT 1 FROM public.ai_profiles WHERE org_number = %s",
                    (orgnr,),
                )
                if cur.fetchone():
                    report["present_in_postgres"].append(orgnr)
                else:
                    report["missing_in_postgres"].append(orgnr)

    pg_conn.close()

    # Clarify sample source for report
    sample_src = "donor ai_profiles" if donor_orgnrs else "Postgres ai_profiles"

    # Print report
    print("=" * 60)
    print("V2 AI Import Validation Report")
    print("=" * 60)
    print("\nPostgres row counts:")
    for t, c in sorted(report["postgres"].items()):
        print(f"  {t}: {c}")
    if report["donor"]:
        print("\nDonor row counts:")
        for t, c in sorted(report["donor"].items()):
            print(f"  {t}: {c}")
    print(f"\nSampled {len(report['sample_orgnrs'])} orgnrs from {sample_src}:")
    print(f"  Present in ai_profiles: {len(report['present_in_postgres'])}")
    print(f"  Missing in ai_profiles: {len(report['missing_in_postgres'])}")
    if report["missing_in_postgres"]:
        print("\nMissing orgnrs (no ai_profile):")
        for o in report["missing_in_postgres"][:20]:
            print(f"    {o}")
        if len(report["missing_in_postgres"]) > 20:
            print(f"    ... and {len(report['missing_in_postgres']) - 20} more")
    if report["present_in_postgres"]:
        print("\nSample present orgnrs:")
        for o in report["present_in_postgres"][:5]:
            print(f"    {o}")
    print("\n" + "=" * 60)

    # Output JSON for docs
    output_path = REPO_ROOT / "docs" / "V2_AI_IMPORT_VALIDATION.md"
    with open(output_path, "w") as f:
        f.write("# V2 AI Import Validation\n\n")
        f.write("Auto-generated by `scripts/validate_v2_ai_import.py`.\n\n")
        f.write("## Postgres row counts\n\n")
        f.write("| Table | Count |\n|-------|-------|\n")
        for t, c in sorted(report["postgres"].items()):
            f.write(f"| {t} | {c} |\n")
        if report["donor"]:
            f.write("\n## Donor row counts\n\n")
            f.write("| Table | Count |\n|-------|-------|\n")
            for t, c in sorted(report["donor"].items()):
                f.write(f"| {t} | {c} |\n")
        f.write("\n## Sample validation\n\n")
        f.write(f"- Sampled {len(report['sample_orgnrs'])} orgnrs from ai_profiles\n")
        f.write(f"- Present in ai_profiles: {len(report['present_in_postgres'])}\n")
        f.write(f"- Missing in ai_profiles: {len(report['missing_in_postgres'])}\n")
        if report["missing_in_postgres"]:
            f.write("\n### Missing orgnrs\n\n")
            for o in report["missing_in_postgres"]:
                f.write(f"- {o}\n")
    print(f"Report written to {output_path}")

    return 0 if not report["missing_in_postgres"] else 1


if __name__ == "__main__":
    sys.exit(main())
