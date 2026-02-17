#!/usr/bin/env python3
"""
Minimal backfill: homepage + email from legacy SQLite → Postgres companies.
Read-only SQLite. Updates only NULL/empty fields. Dry-run by default.

Usage:
    python3 scripts/import_legacy_digital_presence_minimal.py           # dry-run
    python3 scripts/import_legacy_digital_presence_minimal.py --apply
    python3 scripts/import_legacy_digital_presence_minimal.py --apply --limit 100
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlparse, urlunparse

REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_DB = REPO_ROOT / "data" / "legacy_nivo.sqlite"
PREVIEW_CSV = REPO_ROOT / "docs" / "legacy_digital_presence_preview.csv"
SUMMARY_MD = REPO_ROOT / "docs" / "IMPORT_DIGITAL_PRESENCE_SUMMARY.md"

# Reject URLs that are not canonical company homepages (directories, trackers, social, aggregators)
REJECT_URL_PATTERNS = [
    re.compile(r"allabolag\.se", re.I),
    re.compile(r"bolagsfakta\.se", re.I),
    re.compile(r"ratsit\.se", re.I),
    re.compile(r"merinfo\.se", re.I),
    re.compile(r"hitta\.se", re.I),
    re.compile(r"facebook\.com", re.I),
    re.compile(r"linkedin\.com", re.I),
    re.compile(r"instagram\.com", re.I),
    re.compile(r"twitter\.com", re.I),
    re.compile(r"x\.com/", re.I),
    re.compile(r"youtube\.com", re.I),
]
# Reject URLs pointing to files (PDFs, images, archives, Office docs)
REJECT_FILE_EXT = re.compile(
    r"\.(pdf|jpg|jpeg|png|gif|zip|doc|docx|xls|xlsx)(\?|#|$)",
    re.I,
)
EMAIL_VALID = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_URL_LEN = 500


def connect_sqlite_readonly(path: Path) -> sqlite3.Connection:
    uri = f"file:{path.resolve()}?mode=ro&immutable=1"
    return sqlite3.connect(uri, uri=True)


def normalize_url(raw: str | None) -> tuple[str | None, str | None]:
    """
    Returns (root_url, raw_url). root_url is the canonical homepage (scheme + netloc).
    Rejects junk domains, file links, non-http(s). raw_url is original for audit.
    """
    if not raw or not isinstance(raw, str):
        return None, None
    s = raw.strip()
    if len(s) > MAX_URL_LEN or not s:
        return None, None
    if s.startswith("javascript:") or s.startswith("mailto:"):
        return None, None
    if not s.startswith("http://") and not s.startswith("https://"):
        s = "https://" + s
    for pat in REJECT_URL_PATTERNS:
        if pat.search(s):
            return None, None
    if REJECT_FILE_EXT.search(s):
        return None, None
    try:
        p = urlparse(s)
        if not p.netloc:
            return None, None
        root = urlunparse((p.scheme or "https", p.netloc, "", "", "", ""))
        return root, s
    except Exception:
        return None, None


def normalize_email(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip().lower()
    if not s or len(s) > 254 or " " in s:
        return None
    if "@" not in s or "." not in s.split("@")[-1]:
        return None
    if not EMAIL_VALID.match(s):
        return None
    return s


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


def load_legacy_homepages(conn: sqlite3.Connection) -> dict[str, tuple[str, str]]:
    """orgnr -> (root_url, raw_url). Both website_url and redirected_to_url go through same filter."""
    out: dict[str, tuple[str, str]] = {}
    cur = conn.execute("""
        SELECT orgnr, website_url, redirected_to_url
        FROM company_website_discovery
        WHERE orgnr IS NOT NULL AND trim(orgnr) != ''
    """)
    for row in cur.fetchall():
        orgnr = str(row[0]).strip()
        root, raw = normalize_url(row[1])
        if not root:
            root, raw = normalize_url(row[2])
        if root and orgnr and orgnr not in out:
            out[orgnr] = (root, raw or root)
    return out


def load_legacy_emails(conn: sqlite3.Connection) -> dict[str, str]:
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


def load_current(pg_conn, orgnrs: set[str]) -> dict[str, tuple[str | None, str | None]]:
    with pg_conn.cursor() as cur:
        ph = ",".join("%s" for _ in orgnrs)
        cur.execute(f"SELECT orgnr, homepage, email FROM companies WHERE orgnr IN ({ph})", list(orgnrs))
        return {
            str(r[0]): (
                (r[1] and str(r[1]).strip()) or None,
                (r[2] and str(r[2]).strip()) or None,
            )
            for r in cur.fetchall()
        }


def build_proposals(
    legacy_hp: dict[str, tuple[str, str]],
    legacy_em: dict[str, str],
    current: dict[str, tuple[str | None, str | None]],
) -> list[dict]:
    rows = []
    for orgnr in set(legacy_hp) | set(legacy_em):
        if orgnr not in current:
            continue
        ch, ce = current[orgnr]
        hp_pair = legacy_hp.get(orgnr) if not ch else None
        nh = hp_pair[0] if hp_pair else None
        raw_url = hp_pair[1] if hp_pair else ""
        ne = legacy_em.get(orgnr) if not ce else None
        if not nh and not ne:
            continue
        src_tables = []
        src_cols = []
        if nh:
            src_tables.append("company_website_discovery")
            src_cols.append("website_url")
        if ne:
            src_tables.append("company_contact")
            src_cols.append("emails_json")
        rows.append({
            "orgnr": orgnr,
            "current_homepage": ch or "",
            "new_homepage": nh or "",
            "raw_url": raw_url,
            "current_email": ce or "",
            "new_email": ne or "",
            "source_table": ";".join(src_tables),
            "source_column": ";".join(src_cols),
        })
    return rows


def run_dry_run(proposals: list[dict], limit: int | None) -> dict:
    subset = proposals[:limit] if limit else proposals
    PREVIEW_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(PREVIEW_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["orgnr", "current_homepage", "new_homepage", "raw_url", "current_email", "new_email", "source_table", "source_column"],
        )
        w.writeheader()
        w.writerows(subset)
    hp_count = sum(1 for p in proposals if p["new_homepage"])
    em_count = sum(1 for p in proposals if p["new_email"])
    return {
        "candidate_rows": len(proposals),
        "valid_urls": hp_count,
        "valid_emails": em_count,
        "updates_applied": 0,
        "skipped_existing": 0,
    }


def run_apply(proposals: list[dict], limit: int | None) -> dict:
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
        return {
            "candidate_rows": len(proposals),
            "valid_urls": sum(1 for p in proposals if p["new_homepage"]),
            "valid_emails": sum(1 for p in proposals if p["new_email"]),
            "updates_applied": updated_hp + updated_em,
            "skipped_existing": len(subset) - updated_hp - updated_em,
            "updated_homepage": updated_hp,
            "updated_email": updated_em,
        }
    except Exception:
        pg.rollback()
        raise
    finally:
        pg.close()


def write_summary(stats: dict, dry_run: bool) -> None:
    SUMMARY_MD.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Digital Presence Import Summary",
        "",
        f"**Mode:** {'Dry-run' if dry_run else 'Applied'}",
        "",
        "## Counts",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Candidate rows (orgnr with legacy data) | {stats.get('candidate_rows', 0)} |",
        f"| Valid URLs (homepage) | {stats.get('valid_urls', 0)} |",
        f"| Valid emails | {stats.get('valid_emails', 0)} |",
        f"| Updates applied | {stats.get('updates_applied', 0)} |",
        f"| Skipped (existing) | {stats.get('skipped_existing', 0)} |",
        "",
    ]
    if not dry_run:
        lines.extend([
            f"| Homepage updated | {stats.get('updated_homepage', 0)} |",
            f"| Email updated | {stats.get('updated_email', 0)} |",
            "",
        ])
    SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=LEGACY_DB, help="Legacy SQLite path")
    ap.add_argument("--apply", action="store_true", help="Apply updates to Postgres")
    ap.add_argument("--limit", type=int, default=None, help="Limit updates (testing)")
    args = ap.parse_args()

    db_path = args.db if args.db.is_absolute() else (REPO_ROOT / args.db)
    if not db_path.exists():
        print(f"❌ Legacy DB not found: {db_path}")
        return 1

    env = REPO_ROOT / ".env"
    if env.exists():
        from dotenv import load_dotenv
        load_dotenv(env)

    sqlite_conn = connect_sqlite_readonly(db_path)
    legacy_hp = load_legacy_homepages(sqlite_conn)
    legacy_em = load_legacy_emails(sqlite_conn)
    sqlite_conn.close()

    all_orgnr = set(legacy_hp) | set(legacy_em)
    if not all_orgnr:
        print("No legacy data.")
        write_summary({"candidate_rows": 0, "valid_urls": 0, "valid_emails": 0, "updates_applied": 0, "skipped_existing": 0}, True)
        return 0

    pg = get_postgres_conn()
    current = load_current(pg, all_orgnr)
    pg.close()

    proposals = build_proposals(legacy_hp, legacy_em, current)

    if not args.apply:
        stats = run_dry_run(proposals, args.limit)
        write_summary(stats, True)
        print(f"Dry-run: {stats['candidate_rows']} proposals, {stats['valid_urls']} homepage, {stats['valid_emails']} email")
        print(f"Preview: {PREVIEW_CSV}")
        print(f"Summary: {SUMMARY_MD}")
        return 0

    stats = run_apply(proposals, args.limit)
    write_summary(stats, False)
    print(f"Applied: homepage={stats.get('updated_homepage', 0)}, email={stats.get('updated_email', 0)}")
    print(f"Summary: {SUMMARY_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
