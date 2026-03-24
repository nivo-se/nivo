#!/usr/bin/env python3
"""
Split a Layer 2 results CSV into evidence tiers and export a capped manual-URL review sheet.

Use when many rows have pages_fetched_count == 0: keep high-evidence rows for decisions,
export zero-page rows (default first 100) for manual Google lookup of official URLs.

Example:
  PYTHONPATH=. python3 scripts/split_layer2_evidence_tiers.py \\
    --input layer2_out_200/layer2_results_20260324T195338Z.csv \\
    --resolved-csv layer2_out_200/shortlist_resolved.csv \\
    --manual-limit 100

Writes next to --input (or --out-dir):
  <stem>_tier_has_pages.csv      # pages_fetched_count >= 1
  <stem>_tier_zero_pages.csv      # pages_fetched_count == 0
  <stem>_manual_google_url_review.csv  # first --manual-limit zero-page rows, sorted by stage1 desc
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def norm_orgnr(x: Any) -> str:
    return "".join(c for c in str(x or "").strip() if c.isdigit())


def to_int(x: Any, default: int = 0) -> int:
    try:
        return int(float(str(x).strip()))
    except Exception:
        return default


def to_float(x: Any) -> Optional[float]:
    try:
        return float(str(x).strip())
    except Exception:
        return None


def google_suggestion(company_name: str, orgnr: str) -> str:
    name = (company_name or "").strip()
    return f'{name} Sweden organisationsnummer {orgnr} official site'


def load_csv_rows(path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    with path.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        fields = list(rdr.fieldnames or [])
        rows = [dict(x) for x in rdr]
    return fields, rows


def load_resolved_by_org(path: Path) -> Dict[str, Dict[str, Any]]:
    _, rows = load_csv_rows(path)
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        o = norm_orgnr(r.get("orgnr"))
        if o:
            out[o] = r
    return out


def pick_manual_columns(
    layer2_row: Dict[str, Any],
    resolved: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    org = norm_orgnr(layer2_row.get("orgnr"))
    name = (layer2_row.get("company_name") or "").strip()
    stage1 = to_float(layer2_row.get("stage1_total_score"))
    blended = to_float(layer2_row.get("blended_score"))
    r = resolved or {}
    return {
        "orgnr": org,
        "company_name": name,
        "stage1_total_score": "" if stage1 is None else stage1,
        "stage1_rank": r.get("rank", ""),
        "homepage_resolved": r.get("homepage_resolved", ""),
        "homepage_original": r.get("homepage_original", ""),
        "homepage_status": r.get("homepage_status", ""),
        "homepage": r.get("homepage", ""),
        "homepage_used_layer2": layer2_row.get("homepage_used", ""),
        "pages_fetched_count": layer2_row.get("pages_fetched_count", ""),
        "layer2_identity_confidence_low": layer2_row.get("layer2_identity_confidence_low", ""),
        "is_fit_for_nivo": layer2_row.get("is_fit_for_nivo", ""),
        "blended_score": "" if blended is None else blended,
        "google_search_suggestion": google_suggestion(name, org),
        "manual_official_url": "",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Split Layer 2 CSV by pages_fetched_count + manual URL export")
    ap.add_argument("--input", type=Path, required=True, help="layer2_results_*.csv")
    ap.add_argument(
        "--resolved-csv",
        type=Path,
        default=None,
        help="shortlist_resolved.csv (homepage columns merged into manual sheet)",
    )
    ap.add_argument("--out-dir", type=Path, default=None, help="Output directory (default: same as input)")
    ap.add_argument("--manual-limit", type=int, default=100, help="Max rows in manual_google_url_review.csv")
    ap.add_argument(
        "--sort-zero-pages-by",
        choices=["stage1_desc", "orgnr"],
        default="stage1_desc",
        help="Order for manual export (default: best Stage 1 first)",
    )
    args = ap.parse_args()

    inp = args.input.resolve()
    if not inp.is_file():
        print(f"Not found: {inp}", file=sys.stderr)
        return 2

    out_dir = (args.out_dir or inp.parent).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = inp.stem

    fieldnames, rows = load_csv_rows(inp)
    if not rows:
        print("Empty CSV.", file=sys.stderr)
        return 2
    if "pages_fetched_count" not in fieldnames and "orgnr" not in fieldnames:
        print("Expected columns include pages_fetched_count and orgnr.", file=sys.stderr)
        return 2

    resolved_by_org: Dict[str, Dict[str, Any]] = {}
    if args.resolved_csv:
        rp = args.resolved_csv.resolve()
        if not rp.is_file():
            print(f"Resolved CSV not found: {rp}", file=sys.stderr)
            return 2
        resolved_by_org = load_resolved_by_org(rp)

    has_pages: List[Dict[str, Any]] = []
    zero_pages: List[Dict[str, Any]] = []
    for r in rows:
        p = to_int(r.get("pages_fetched_count"))
        if p <= 0:
            zero_pages.append(r)
        else:
            has_pages.append(r)

    # Sort zero-page rows for manual pass
    def sort_key(r: Dict[str, Any]) -> Tuple[Any, ...]:
        s1 = to_float(r.get("stage1_total_score"))
        if args.sort_zero_pages_by == "stage1_desc":
            return (-(s1 if s1 is not None else -1.0), norm_orgnr(r.get("orgnr")))
        return (norm_orgnr(r.get("orgnr")),)

    zero_sorted = sorted(zero_pages, key=sort_key)
    manual_rows = zero_sorted[: max(0, args.manual_limit)]

    manual_fields = [
        "orgnr",
        "company_name",
        "stage1_total_score",
        "stage1_rank",
        "homepage_resolved",
        "homepage_original",
        "homepage_status",
        "homepage",
        "homepage_used_layer2",
        "pages_fetched_count",
        "layer2_identity_confidence_low",
        "is_fit_for_nivo",
        "blended_score",
        "google_search_suggestion",
        "manual_official_url",
    ]

    path_has = out_dir / f"{stem}_tier_has_pages.csv"
    path_zero = out_dir / f"{stem}_tier_zero_pages.csv"
    path_manual = out_dir / f"{stem}_manual_google_url_review.csv"

    for path, data in (
        (path_has, has_pages),
        (path_zero, zero_pages),
    ):
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            for r in data:
                w.writerow(r)

    with path_manual.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=manual_fields, extrasaction="ignore")
        w.writeheader()
        for r in manual_rows:
            org = norm_orgnr(r.get("orgnr"))
            res = resolved_by_org.get(org)
            w.writerow(pick_manual_columns(r, res))

    n = len(rows)
    z = len(zero_pages)
    h = len(has_pages)
    fit_hp = sum(
        1
        for r in has_pages
        if str(r.get("is_fit_for_nivo", "")).strip().lower() in ("true", "1")
    )
    fit_z = sum(
        1
        for r in zero_pages
        if str(r.get("is_fit_for_nivo", "")).strip().lower() in ("true", "1")
    )
    id_low_z = sum(
        1
        for r in zero_pages
        if str(r.get("layer2_identity_confidence_low", "")).strip().lower() in ("true", "1")
    )

    print("=== Layer 2 evidence split ===")
    print(f"input: {inp}")
    print(f"rows: {n}")
    print(f"tier_has_pages (pages_fetched_count >= 1): {h} ({100*h/n:.1f}%)")
    print(f"tier_zero_pages: {z} ({100*z/n:.1f}%)")
    print(f"is_fit_for_nivo True — has_pages: {fit_hp}/{h} | zero_pages: {fit_z}/{z}")
    print(f"layer2_identity_confidence_low True — zero_pages only: {id_low_z}/{z}")
    print("")
    print("Wrote:")
    print(f"  {path_has}")
    print(f"  {path_zero}")
    print(f"  {path_manual} ({len(manual_rows)} rows, cap={args.manual_limit})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
