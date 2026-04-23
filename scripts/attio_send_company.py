#!/usr/bin/env python3
"""Send one company (with its contacts + latest research summary) to Attio.

Single end-to-end test of the push pipeline. Loads from Postgres, calls
`backend.services.attio.push.send_company_to_attio`, prints the SendResult,
and (on success) caches the returned record_ids back into
`deep_research.companies.attio_record_id` and `deep_research.contacts.attio_record_id`.

Usage:
    cd /path/to/nivo
    export ATTIO_API_KEY=<key>
    export ATTIO_SYNC_ENABLED=true

    # By Nivo company UUID:
    python3 scripts/attio_send_company.py --company-id 7c0a...e3

    # By orgnr:
    python3 scripts/attio_send_company.py --orgnr 5560000000

    # Preview the bundle without calling Attio:
    python3 scripts/attio_send_company.py --orgnr 5560000000 --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        return
    _load(dotenv_path=env_path)


def _connect():
    import psycopg2
    import psycopg2.extras

    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=5,
    )


from backend.services.attio.loader import load_bundle, persist_record_ids


def main() -> int:
    parser = argparse.ArgumentParser(description="Send one company to Attio")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--company-id", help="UUID in deep_research.companies")
    g.add_argument("--orgnr", help="Org number in deep_research.companies")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print bundle (company + contacts + summary) without calling Attio.")
    parser.add_argument("--no-research-note", action="store_true",
                        help="Skip the research summary note (push company + contacts only).")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    _load_dotenv()

    if not args.dry_run and os.environ.get("ATTIO_SYNC_ENABLED", "").lower() != "true":
        print("❌ ATTIO_SYNC_ENABLED is not 'true' (push is a no-op without it).")
        print("   Either export ATTIO_SYNC_ENABLED=true or pass --dry-run.")
        return 1

    conn = _connect()
    cur = conn.cursor()
    try:
        bundle = load_bundle(
            cur,
            company_id=args.company_id,
            orgnr=args.orgnr,
            include_research_summary=not args.no_research_note,
        )
        if bundle is None:
            print("❌ Company not found.")
            return 1

        company = bundle.company
        contacts = bundle.contacts
        research_md = bundle.research_summary_markdown

        print(f"Company: {company['name']} (orgnr={company['orgnr']}, website={company['website']})")
        print(f"Contacts: {len(contacts)}")
        if research_md:
            print(f"Research summary: {len(research_md)} chars")
        else:
            print("Research summary: (none — no analysis_runs row)")

        if args.dry_run:
            print("\n--- Bundle preview (dry-run) ---")
            print(json.dumps({
                "company": {k: v for k, v in company.items() if k != "id"},
                "contacts": [{k: v for k, v in c.items() if k != "id"} for c in contacts],
                "research_markdown_preview": (research_md or "")[:500],
            }, indent=2, default=str))
            return 0

        from backend.services.attio.push import send_company_to_attio

        result = send_company_to_attio(
            company=company,
            contacts=contacts,
            research_summary_markdown=research_md,
        )

        if result.skipped:
            print("⚠️  Skipped (ATTIO_SYNC_ENABLED!=true).")
            return 1

        persist_record_ids(cur, company_uuid=company["id"], result=result)
        conn.commit()

        print()
        print(f"company_record_id   : {result.company_record_id}")
        print(f"contacts pushed     : {len(result.contact_record_ids)}/{len(contacts)}")
        print(f"notes appended      : {len(result.note_record_ids)}")
        if result.errors:
            print(f"errors              : {len(result.errors)}")
            for e in result.errors:
                print(f"  - {e}")
        else:
            print("errors              : 0")
        print()
        print(f"✅ Done. Open in Attio: https://app.attio.com/_/objects/companies/record/{result.company_record_id}")
        return 0 if result.ok else 2
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
