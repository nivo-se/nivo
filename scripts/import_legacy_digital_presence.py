#!/usr/bin/env python3
"""
Import homepage and email from legacy SQLite into Postgres companies table.
Read-only on SQLite. Dry-run by default.

Usage:
    python3 scripts/import_legacy_digital_presence.py [--dry-run]   # default: dry-run
    python3 scripts/import_legacy_digital_presence.py --apply
    python3 scripts/import_legacy_digital_presence.py --apply --limit 100
    python3 scripts/import_legacy_digital_presence.py --dry-run --audit-out docs/legacy_import_audit.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = REPO_ROOT / "data" / "legacy_nivo.sqlite"
PREVIEW_CSV = REPO_ROOT / "docs" / "legacy_digital_presence_preview.csv"

# Reject URL patterns (junk / not company homepages)
REJECT_URL_PATTERNS = [
    re.compile(r"allabolag\.se", re.I),
    re.compile(r"bolagsfakta\.se", re.I),
    re.compile(r"ratsit\.se", re.I),
]
EMAIL_VALID = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_URL_LEN = 500


def connect_sqlite_readonly(db_path: Path) -> sqlite3.Connection:
    uri = f"file:{db_path.resolve()}?mode=ro&immutable=1"
    return sqlite3.connect(uri, uri=True)


def normalize_url(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if len(s) > MAX_URL_LEN:
        return None
    if not s or s.startswith("javascript:"):
        return None
    for pat in REJECT_URL_PATTERNS:
        if pat.search(s):
            return None
    if not s.startswith("http"):
        s = "https://" + s
    return s


def normalize_email(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip().lower()
    if not s or len(s) > 254:
        return None
    if EMAIL_VALID.match(s) and "@" in s and "." in s.split("@")[-1]:
        return s
    return None


def first_valid_email(emails_json: str | None) -> str | None:
    if not emails_json:
        return None
    try:
        arr = json.loads(emails_json) if isinstance(emails_json, str) else emails_json
        if not isinstance(arr, list):
            return None
        for e in arr:
            if isinstance(e, str) and (em := normalize_email(e)):
                return em
        return None
    except (json.JSONDecodeError, TypeError):
        return None


def extract_emails_from_contact_json(contact_json: str | None) -> list[str]:
    if not contact_json:
        return []
    try:
        obj = json.loads(contact_json) if isinstance(contact_json, str) else contact_json
        if not isinstance(obj, dict):
            return []
        emails = obj.get("emails") or []
        out = []
        for e in emails if isinstance(emails, list) else []:
            if isinstance(e, str) and (em := normalize_email(e)):
                out.append(em)
        return out
    except (json.JSONDecodeError, TypeError):
        return []


def load_legacy_homepages(conn: sqlite3.Connection) -> dict[str, str]:
    """orgnr -> normalized homepage. Prefer website_url, fallback redirected_to_url."""
    out: dict[str, str] = {}
    cur = conn.execute("""
        SELECT orgnr, website_url, redirected_to_url
        FROM company_website_discovery
        WHERE orgnr IS NOT NULL AND trim(orgnr) != ''
    """)
    for row in cur.fetchall():
        orgnr = str(row[0]).strip()
        url = normalize_url(row[1]) or normalize_url(row[2])
        if url and orgnr and (orgnr not in out or not out[orgnr]):
            out[orgnr] = url
    return out


def load_legacy_emails(conn: sqlite3.Connection) -> dict[str, str]:
    """orgnr -> first valid email from emails_json."""
    out: dict[str, str] = {}
    cur = conn.execute("""
        SELECT orgnr, emails_json
        FROM company_contact
        WHERE orgnr IS NOT NULL AND trim(orgnr) != '' AND emails_json IS NOT NULL
    """)
    for row in cur.fetchall():
        orgnr = str(row[0]).strip()
        em = first_valid_email(row[1])
        if em and orgnr and orgnr not in out:
            out[orgnr] = em
    return out


def get_postgres_conn():
    import psycopg2
    url = os.getenv("DATABASE_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=5)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=5,
    )


def load_current_companies(pg_conn, orgnrs: set[str] | None = None) -> dict[str, tuple[str | None, str | None]]:
    """orgnr -> (homepage, email). Only load orgnrs we might update if orgnrs set."""
    with pg_conn.cursor() as cur:
        if orgnrs:
            placeholders = ",".join("%s" for _ in orgnrs)
            cur.execute(
                f"SELECT orgnr, homepage, email FROM companies WHERE orgnr IN ({placeholders})",
                list(orgnrs),
            )
        else:
            cur.execute("SELECT orgnr, homepage, email FROM companies")
        return {
            str(r[0]): (
                r[1] if r[1] and str(r[1]).strip() else None,
                r[2] if r[2] and str(r[2]).strip() else None,
            )
            for r in cur.fetchall()
        }


def build_proposed_updates(
    legacy_homepages: dict[str, str],
    legacy_emails: dict[str, str],
    current: dict[str, tuple[str | None, str | None]],
    only_missing: bool,
) -> list[dict]:
    """Proposed updates: orgnr, current_homepage, new_homepage, current_email, new_email, source_*."""
    proposals = []
    all_orgnr = set(legacy_homepages) | set(legacy_emails)
    for orgnr in all_orgnr:
        ch, ce = current.get(orgnr, (None, None))
        nh = legacy_homepages.get(orgnr)
        ne = legacy_emails.get(orgnr)
        if only_missing:
            if ch and nh:
                nh = None
            if ce and ne:
                ne = None
        if not nh and not ne:
            continue
        proposals.append({
            "orgnr": orgnr,
            "current_homepage": ch or "",
            "new_homepage": nh or "",
            "current_email": ce or "",
            "new_email": ne or "",
            "source_homepage": "company_website_discovery.website_url" if nh else "",
            "source_email": "company_contact.emails_json" if ne else "",
        })
    return proposals


def run_dry_run(
    proposals: list[dict],
    audit_out: Path | None,
    preview_csv: Path,
    limit: int | None,
) -> None:
    subset = proposals[:limit] if limit else proposals
    preview_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(preview_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["orgnr", "current_homepage", "new_homepage", "current_email", "new_email", "source_homepage", "source_email"],
        )
        w.writeheader()
        w.writerows(subset)
    print(f"Dry run: {len(proposals)} proposed updates (wrote {len(subset)} to {preview_csv})")
    hp_count = sum(1 for p in proposals if p["new_homepage"])
    em_count = sum(1 for p in proposals if p["new_email"])
    print(f"  - Would set homepage: {hp_count}")
    print(f"  - Would set email: {em_count}")
    if subset:
        print("Example:")
        for p in subset[:3]:
            print(f"  orgnr={p['orgnr']} homepage={p['new_homepage'] or '-'} email={p['new_email'] or '-'}")
    if audit_out:
        audit_out.parent.mkdir(parents=True, exist_ok=True)
        with open(audit_out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(subset[0].keys()))
            w.writeheader()
            w.writerows(subset)
        print(f"Audit CSV: {audit_out}")


def run_apply(
    proposals: list[dict],
    limit: int | None,
    only_missing: bool,
) -> None:
    import psycopg2
    subset = proposals[:limit] if limit else proposals
    pg = get_postgres_conn()
    updated_hp = 0
    updated_em = 0
    skipped = 0
    try:
        with pg.cursor() as cur:
            for p in subset:
                orgnr = p["orgnr"]
                nh = p["new_homepage"] or None
                ne = p["new_email"] or None
                if not nh and not ne:
                    skipped += 1
                    continue
                if only_missing:
                    cur.execute(
                        "SELECT homepage, email FROM companies WHERE orgnr = %s",
                        (orgnr,),
                    )
                    row = cur.fetchone()
                    if not row:
                        skipped += 1
                        continue
                    ch, ce = (row[0] and str(row[0]).strip()) or None, (row[1] and str(row[1]).strip()) or None
                    if nh and ch:
                        nh = None
                    if ne and ce:
                        ne = None
                if nh:
                    cur.execute(
                        "UPDATE companies SET homepage = %s, updated_at = NOW() WHERE orgnr = %s AND (homepage IS NULL OR trim(homepage) = '')",
                        (nh, orgnr),
                    )
                    if cur.rowcount:
                        updated_hp += 1
                if ne:
                    cur.execute(
                        "UPDATE companies SET email = %s, updated_at = NOW() WHERE orgnr = %s AND (email IS NULL OR trim(email) = '')",
                        (ne, orgnr),
                    )
                    if cur.rowcount:
                        updated_em += 1
        pg.commit()
        print(f"Applied: updated_homepage={updated_hp}, updated_email={updated_em}, skipped={skipped}")
    except Exception as e:
        pg.rollback()
        raise RuntimeError(f"Apply failed: {e}") from e
    finally:
        pg.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Import legacy digital presence into Postgres")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="Legacy SQLite path")
    ap.add_argument("--apply", action="store_true", help="Perform Postgres updates (default: dry-run)")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of updates (for testing)")
    ap.add_argument("--only-missing", action="store_true", default=True, help="Only update when Postgres field is empty")
    ap.add_argument("--audit-out", type=Path, default=None, help="Write audit CSV of proposed changes")
    ap.add_argument("--preview-csv", type=Path, default=PREVIEW_CSV, help="Preview CSV path")
    args = ap.parse_args()

    dry_run = not args.apply

    db_path = args.db if args.db.is_absolute() else (REPO_ROOT / args.db)
    if not db_path.exists():
        print(f"❌ Legacy DB not found: {db_path}")
        return 1

    # Load env
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

    conn = connect_sqlite_readonly(db_path)
    legacy_hp = load_legacy_homepages(conn)
    legacy_em = load_legacy_emails(conn)
    conn.close()

    all_orgnr = set(legacy_hp) | set(legacy_em)
    if not all_orgnr:
        print("No legacy data to import.")
        return 0

    pg = get_postgres_conn()
    current = load_current_companies(pg, all_orgnr)
    pg.close()

    # Only propose for orgnrs that exist in Postgres
    existing_orgnr = set(current)
    proposals = build_proposed_updates(legacy_hp, legacy_em, current, args.only_missing)
    proposals = [p for p in proposals if p["orgnr"] in existing_orgnr]

    if not args.apply:
        run_dry_run(proposals, args.audit_out, args.preview_csv, args.limit)
        return 0

    run_apply(proposals, args.limit, args.only_missing)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
