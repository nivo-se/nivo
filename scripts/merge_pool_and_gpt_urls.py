#!/usr/bin/env python3
"""
Join Layer-1 pool CSV with GPT URL retrieval output → one canonical row per orgnr.

Pool (screening features export) carries financials, NACE, registry homepage, segments.
URL file carries ``official_website_url`` from ``gpt_batch_website_urls_500`` + retry.

Output columns: all pool columns, then GPT URL fields (prefixed ``gpt_``), then
``website_resolution`` = has_gpt_url | no_gpt_url (empty string after retrieval).

Usage:
  PYTHONPATH=. .venv/bin/python3 scripts/merge_pool_and_gpt_urls.py \\
    --pool-csv scripts/fixtures/gpt_website_retrieval_shortlist_pool.csv \\
    --urls-csv scripts/fixtures/gpt_website_retrieval_runs/gpt500_urls_chat_search/retry_complete/merged_urls_complete.csv \\
    --out-csv scripts/fixtures/gpt_website_retrieval_runs/gpt500_pool_plus_urls.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from screening_manifest_utils import git_commit_hash, sha256_file, utc_timestamp_iso, write_json


def _norm_orgnr_key(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def _read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge screening pool CSV + GPT merged URLs.")
    ap.add_argument("--pool-csv", type=Path, required=True)
    ap.add_argument("--urls-csv", type=Path, required=True)
    ap.add_argument("--out-csv", type=Path, required=True)
    ap.add_argument("--out-manifest", type=Path, default=None, help="JSON sidecar (default: out-csv stem + _manifest.json)")
    args = ap.parse_args()

    pool_path = args.pool_csv.resolve()
    urls_path = args.urls_csv.resolve()
    out_csv = args.out_csv.resolve()
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    pool_rows = _read_csv(pool_path)
    url_rows = _read_csv(urls_path)

    by_org: Dict[str, Dict[str, str]] = {}
    for r in url_rows:
        k = _norm_orgnr_key(r.get("orgnr") or "")
        if k:
            by_org[k] = r

    out_rows: List[Dict[str, Any]] = []
    for pr in pool_rows:
        k = _norm_orgnr_key(pr.get("orgnr") or "")
        ur = by_org.get(k, {})
        gpt_url = (ur.get("official_website_url") or "").strip()
        merged: Dict[str, Any] = dict(pr)
        merged["gpt_official_website_url"] = gpt_url
        merged["gpt_url_confidence"] = ur.get("confidence_0_1") or ""
        merged["gpt_url_source_note"] = ur.get("source_note") or ""
        merged["gpt_url_batch_index"] = ur.get("batch_index") or ""
        merged["website_resolution"] = "has_gpt_url" if gpt_url else "no_gpt_url"
        out_rows.append(merged)

    # Column order: pool fieldnames as first row keys, then gpt_* , website_resolution
    pool_fields = list(pool_rows[0].keys()) if pool_rows else []
    extra = [
        "gpt_official_website_url",
        "gpt_url_confidence",
        "gpt_url_source_note",
        "gpt_url_batch_index",
        "website_resolution",
    ]
    fieldnames = pool_fields + [c for c in extra if c not in pool_fields]

    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    man_path = args.out_manifest or out_csv.with_name(out_csv.stem + "_manifest.json")
    write_json(
        man_path.resolve(),
        {
            "script": "merge_pool_and_gpt_urls.py",
            "created_at_utc": utc_timestamp_iso(),
            "git_commit": git_commit_hash(REPO_ROOT),
            "pool_csv": str(pool_path),
            "pool_sha256": sha256_file(pool_path),
            "urls_csv": str(urls_path),
            "urls_sha256": sha256_file(urls_path),
            "out_csv": str(out_csv),
            "row_count": len(out_rows),
            "has_gpt_url": sum(1 for r in out_rows if r.get("website_resolution") == "has_gpt_url"),
            "no_gpt_url": sum(1 for r in out_rows if r.get("website_resolution") == "no_gpt_url"),
        },
    )
    print(f"Wrote {out_csv} ({len(out_rows)} rows)", file=sys.stderr)
    print(f"Manifest {man_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
