#!/usr/bin/env python3
"""
Resolve and verify official homepages for rows already in a shortlist CSV (input-only).

Does not discover new companies. Tavily is used only to fix missing/dead/mismatched URLs.

Usage:
  Production input should be Stage 1 output (e.g. shortlist_200.csv from screening_rank_v1.py),
  not scripts/fixtures/layer2_*.csv.

  cd /path/to/nivo && PYTHONPATH=. python3 scripts/resolve_homepages_for_shortlist.py \\
    --input shortlist_200.csv \\
    --out-resolved /tmp/shortlist_resolved.csv \\
    --out-excluded /tmp/shortlist_excluded.csv

  # Then Layer 2 (same universe, resolved homepages only):
  PYTHONPATH=. python3 scripts/screening_layer2_run.py \\
    --input /tmp/shortlist_resolved.csv --out-dir /tmp/layer2_run

Requires: TAVILY_API_KEY in environment (for rows that need resolution), httpx, bs4.

Exit codes: 0 success, 2 bad input. (Tavily unavailable rows remain unresolved; Layer 2 can still run in homepage-missing mode.)
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path
from typing import List, Set

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from backend.services.shortlist_homepage_resolver import (
    DEFAULT_MAJOR_NAME_KEYWORDS,
    DEFAULT_MAJOR_ORGNR_DENYLIST,
    collect_tavily_startup_diagnostics,
    resolve_shortlist_rows,
    row_needs_homepage_tavily_lookup,
)
from backend.services.shortlist_homepage_resolver.resolver import classify_exclusion

logger = logging.getLogger(__name__)

RESOLUTION_FIELDS = [
    "homepage_original",
    "homepage_resolved",
    "homepage_status",
    "homepage_resolution_method",
    "homepage_resolution_confidence",
    "homepage_resolution_notes",
]


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _parse_orgnr_set(arg: str | None, path: Path | None) -> Set[str]:
    out: Set[str] = set()
    if arg:
        for part in arg.replace(",", " ").split():
            p = "".join(c for c in part if c.isdigit())
            if len(p) >= 10:
                out.add(p)
    if path and path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            for part in line.replace(",", " ").split():
                p = "".join(c for c in part if c.isdigit())
                if len(p) >= 10:
                    out.add(p)
    return out


def _write_csv(path: Path, fieldnames: List[str], rows: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def _merge_fieldnames(base: List[str], rows: list) -> List[str]:
    seen = list(base)
    for row in rows:
        for k in row:
            if k not in seen:
                seen.append(k)
    return seen


def main() -> None:
    _load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    ap = argparse.ArgumentParser(description="Resolve homepages for an existing shortlist CSV (input-only)")
    ap.add_argument("--input", type=Path, required=True, help="Shortlist CSV (orgnr, company_name, optional homepage, …)")
    ap.add_argument("--out-resolved", type=Path, required=True, help="Output CSV: same rows after exclusions + resolution")
    ap.add_argument("--out-excluded", type=Path, required=True, help="Output CSV: excluded rows + exclusion_reason")
    ap.add_argument(
        "--extra-denylist-orgnrs",
        type=str,
        default="",
        help="Extra orgnrs to exclude (comma/space separated)",
    )
    ap.add_argument(
        "--denylist-orgnrs-file",
        type=Path,
        default=None,
        help="File with orgnrs (one per line or comma-separated)",
    )
    ap.add_argument(
        "--no-default-major-exclusions",
        action="store_true",
        help="Do not apply DEFAULT_MAJOR_ORGNR_DENYLIST / name keywords",
    )
    ap.add_argument(
        "--extra-name-keywords",
        type=str,
        default="",
        help="Extra lowercase substrings to exclude when matched in company_name (comma-separated)",
    )
    ap.add_argument(
        "--min-revenue-column",
        type=str,
        default=None,
        help="Optional CSV column: exclude row if value >= --min-revenue-threshold",
    )
    ap.add_argument(
        "--min-revenue-threshold",
        type=float,
        default=None,
        help="See --min-revenue-column",
    )
    ap.add_argument("--sleep", type=float, default=0.25, help="Pause seconds between eligible rows (HTTP/Tavily)")
    ap.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N data rows (still from this file only; order preserved)",
    )
    ap.add_argument("--out-summary", type=Path, default=None, help="Optional JSON summary path")
    args = ap.parse_args()

    if not args.input.is_file():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        print(
            "Use a real path, e.g. --input scripts/fixtures/layer2_smoke_batch.csv "
            "(from repo root, with PYTHONPATH=.)",
            file=sys.stderr,
        )
        sys.exit(2)

    with args.input.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "orgnr" not in reader.fieldnames or "company_name" not in reader.fieldnames:
            print("CSV must include orgnr and company_name columns.", file=sys.stderr)
            sys.exit(2)
        base_fields = list(reader.fieldnames)
        rows = list(reader)
    if args.limit is not None:
        rows = rows[: max(0, args.limit)]

    extra_org = _parse_orgnr_set(args.extra_denylist_orgnrs, args.denylist_orgnrs_file)
    if args.no_default_major_exclusions:
        manual = frozenset(extra_org)
        keywords: tuple[str, ...] = tuple(
            x.strip().lower() for x in args.extra_name_keywords.split(",") if x.strip()
        )
    else:
        manual = frozenset(DEFAULT_MAJOR_ORGNR_DENYLIST | frozenset(extra_org))
        kw_extra = [x.strip().lower() for x in args.extra_name_keywords.split(",") if x.strip()]
        keywords = tuple(dict.fromkeys(list(DEFAULT_MAJOR_NAME_KEYWORDS) + kw_extra))

    logger.info(
        "Resolving %d input rows (exclusions: default_major=%s extra_orgnrs=%d)",
        len(rows),
        not args.no_default_major_exclusions,
        len(extra_org),
    )

    startup = collect_tavily_startup_diagnostics()
    homepage_in_csv = "homepage" in base_fields
    logger.info("Input columns (%d): %s", len(base_fields), ", ".join(base_fields))
    logger.info("homepage column present: %s", homepage_in_csv)
    if rows:
        r0 = rows[0]
        logger.info(
            "Sample row[0]: orgnr=%r company_name=%r homepage=%r",
            str(r0.get("orgnr", ""))[:32],
            str(r0.get("company_name", ""))[:80],
            r0.get("homepage"),
        )

    eligible_need_tavily = 0
    for r in rows:
        orgnr = str(r.get("orgnr", "")).strip()
        name = str(r.get("company_name", "")).strip()
        if not orgnr or not name:
            continue
        if classify_exclusion(
            orgnr,
            name,
            r,
            manual_orgnrs=manual,
            name_keywords=keywords,
            min_revenue_column=args.min_revenue_column,
            min_revenue_threshold=args.min_revenue_threshold,
        ):
            continue
        if row_needs_homepage_tavily_lookup(r):
            eligible_need_tavily += 1

    logger.info(
        "Tavily startup: import_ok=%s api_key_env=%s api_key_configured=%s available=%s",
        startup.get("tavily_import_ok"),
        startup.get("tavily_api_key_env_present"),
        startup.get("tavily_api_key_configured"),
        startup.get("tavily_available"),
    )
    if not startup.get("tavily_available") and eligible_need_tavily > 0:
        if not startup.get("tavily_import_ok"):
            hint = (
                "Tavily client could not import (often missing `requests` in this Python). "
                "Use the project venv, e.g. backend/venv/bin/python with PYTHONPATH=., or install backend deps."
            )
        elif not startup.get("tavily_api_key_configured"):
            hint = "Set TAVILY_API_KEY in .env or environment, or configure it in backend settings."
        else:
            hint = "See tavily_startup in this JSON."
        logger.warning(
            "Tavily unavailable but %d rows have no manual homepage; they will stay unresolved. %s",
            eligible_need_tavily,
            hint,
        )

    resolved, excluded, stats = resolve_shortlist_rows(
        rows,
        manual_orgnrs=manual,
        name_keywords=keywords,
        min_revenue_column=args.min_revenue_column,
        min_revenue_threshold=args.min_revenue_threshold,
        pause_seconds=args.sleep,
        tavily_startup=startup,
    )

    # Ensure resolution columns exist in field order
    fn_res = list(base_fields)
    for c in RESOLUTION_FIELDS:
        if c not in fn_res:
            fn_res.append(c)
    fn_res = _merge_fieldnames(fn_res, resolved)

    fn_ex = list(base_fields)
    if "exclusion_reason" not in fn_ex:
        fn_ex.append("exclusion_reason")
    fn_ex = _merge_fieldnames(fn_ex, excluded)

    _write_csv(args.out_resolved, fn_res, resolved)
    _write_csv(args.out_excluded, fn_ex, excluded)

    summary = {
        "input_csv": str(args.input.resolve()),
        "input_columns": list(base_fields),
        "homepage_column_in_csv": homepage_in_csv,
        "input_rows": len(rows),
        "resolved_rows": len(resolved),
        "excluded_rows": len(excluded),
        "homepage_status_counts": {
            "manual_curated": stats.get("manual_curated", 0),
            "verified_existing": stats["verified_existing"],
            "resolved_tavily": stats["resolved_tavily"],
            "unresolved": stats["unresolved"],
            "rejected_mismatch": stats["rejected_mismatch"],
            "dead_original": stats["dead_original"],
        },
        "excluded_count": stats["excluded"],
        "rejected_directory_candidates": stats.get("rejected_directory_candidates", 0),
        "accepted_first_party_domains": stats.get("accepted_first_party_domains", 0),
        "unresolved_rows": stats.get("unresolved_rows", stats.get("unresolved", 0)),
        "tavily_attempted_rows": stats.get("tavily_attempted_rows", 0),
        "tavily_startup": stats.get("tavily_startup", startup),
        "tavily_runtime_counts": stats.get("tavily_runtime_counts", {}),
    }
    rtc = summary["tavily_runtime_counts"]
    if (
        rtc.get("tavily_search_calls", 0) > 0
        and rtc.get("tavily_search_calls_with_results", 0) == 0
        and summary["homepage_status_counts"].get("unresolved", 0) > 0
    ):
        summary["resolver_warning"] = (
            "tavily_search_returned_empty_for_every_call; check API key, network, and quotas."
        )
    print(json.dumps(summary, indent=2))
    if args.out_summary:
        args.out_summary.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    logger.info("Wrote resolved: %s", args.out_resolved)
    logger.info("Wrote excluded: %s", args.out_excluded)


if __name__ == "__main__":
    main()
