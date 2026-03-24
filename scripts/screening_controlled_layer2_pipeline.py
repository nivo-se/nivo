#!/usr/bin/env python3
"""
Controlled Layer 2 screening pipeline: resolve homepages → validate → Layer 2 → validate.

Strict input-only: only orgnrs present in the input CSV are processed; resolver and Layer 2
do not discover new companies.

Production input (required):
  1. Generate Stage 1 CSV only via scripts/screening_rank_v1.py (see that script's docstring).
  2. Save as shortlist_200.csv at the repo root (e.g. --top 200 --out shortlist_200.csv).
  3. Manually inspect names/orgnrs before running this pipeline.
  4. Run:
       PYTHONPATH=. python3 scripts/screening_controlled_layer2_pipeline.py \\
         --out-dir layer2_out_200

Do not use scripts/fixtures/layer2_*.csv for production evaluation. For local dev only,
pass --allow-fixtures-for-dev together with --input …/fixtures/….

Default --input is <repo>/shortlist_200.csv.

Exits:
  0 — all gates passed
  2 — bad CLI / missing input file / forbidden fixture input
  3 — resolver or post-layer2 validation failed (see controlled_run_report.json)
"""

from __future__ import annotations

import argparse
import csv
import fnmatch
import json
import logging
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
    homepage_domain_is_blocklisted,
)

logger = logging.getLogger(__name__)

MAX_UNUSABLE_HOMEPAGE_PCT = 5.0
MAX_ZERO_PAGES_PCT = 10.0


def _is_forbidden_layer2_fixture_csv(path: Path) -> bool:
    """Production runs must not use scripts/fixtures/layer2_*.csv (smoke / batch tests)."""
    fixtures_dir = (REPO_ROOT / "scripts" / "fixtures").resolve()
    try:
        path.resolve().relative_to(fixtures_dir)
    except ValueError:
        return False
    return fnmatch.fnmatch(path.name.lower(), "layer2_*.csv")


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _norm_orgnr(x: Any) -> str:
    return "".join(c for c in str(x).strip() if c.isdigit())


def _row_homepage_unusable(row: Dict[str, Any]) -> bool:
    st = (row.get("homepage_status") or "").strip()
    hr = (row.get("homepage_resolved") or row.get("homepage") or "").strip()
    if st in ("unresolved", "dead_original", "rejected_mismatch"):
        return True
    if not hr:
        return True
    return False


def _suspicious_homepage_url(url: str) -> Optional[str]:
    if not url or not url.startswith("http"):
        return None
    host = urlparse(url).netloc
    if homepage_domain_is_blocklisted(host):
        return "resolver_blocklist"
    return None


def _homepage_path_depth(url: str) -> int:
    if not url or not url.startswith("http"):
        return 0
    p = urlparse(url).path.strip("/")
    if not p:
        return 0
    return len([x for x in p.split("/") if x])


def _validate_resolver_outputs(
    input_rows: List[Dict[str, Any]],
    resolved: List[Dict[str, Any]],
    excluded: List[Dict[str, Any]],
) -> Tuple[bool, Dict[str, Any]]:
    """Partition check + unusable homepage rate + suspicious domains."""
    n_in = len(input_rows)
    n_out = len(resolved) + len(excluded)
    org_in = Counter(_norm_orgnr(r.get("orgnr")) for r in input_rows if _norm_orgnr(r.get("orgnr")))
    org_ex = Counter(_norm_orgnr(r.get("orgnr")) for r in excluded if _norm_orgnr(r.get("orgnr")))
    org_re = Counter(_norm_orgnr(r.get("orgnr")) for r in resolved if _norm_orgnr(r.get("orgnr")))
    org_joined = org_ex + org_re

    partition_ok = n_in == n_out and org_in == org_joined
    unusable = sum(1 for r in resolved if _row_homepage_unusable(r))
    n_res = len(resolved)
    unusable_pct = (100.0 * unusable / n_res) if n_res else 0.0
    gate_unusable = unusable_pct > MAX_UNUSABLE_HOMEPAGE_PCT

    suspicious: List[Dict[str, str]] = []
    non_root: List[Dict[str, str]] = []
    for r in resolved:
        o = _norm_orgnr(r.get("orgnr"))
        url = (r.get("homepage_resolved") or r.get("homepage") or "").strip()
        hit = _suspicious_homepage_url(url)
        if hit:
            suspicious.append({"orgnr": o, "url": url, "reason": f"suspicious_host:{hit}"})
        if url and _homepage_path_depth(url) > 0:
            non_root.append({"orgnr": o, "url": url})

    gate_suspicious = len(suspicious) > 0

    detail = {
        "input_row_count": n_in,
        "resolved_row_count": n_res,
        "excluded_row_count": len(excluded),
        "partition_ok": partition_ok,
        "orgnr_counter_match": org_in == org_joined,
        "unusable_homepage_count": unusable,
        "unusable_homepage_pct": round(unusable_pct, 2),
        "gate_unusable_homepage_pct_le_5": not gate_unusable,
        "suspicious_domain_hits": suspicious,
        "gate_no_suspicious_domains": not gate_suspicious,
        "homepage_not_root_domain_rows": non_root[:50],
        "homepage_not_root_domain_count": len(non_root),
    }
    ok = partition_ok and not gate_unusable and not gate_suspicious
    return ok, detail


def _latest_layer2_csv(out_dir: Path) -> Optional[Path]:
    paths = sorted(out_dir.glob("layer2_results_*.csv"))
    return paths[-1] if paths else None


def _parse_bool_cell(x: Any) -> bool:
    if isinstance(x, bool):
        return x
    s = str(x).strip().lower()
    return s in ("true", "1", "yes")


def _validate_layer2_csv(
    resolved_path: Path,
    layer2_csv: Path,
    *,
    partial_limit: Optional[int] = None,
) -> Tuple[bool, Dict[str, Any]]:
    with resolved_path.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        res_rows = list(rdr)
    org_res = [_norm_orgnr(r.get("orgnr")) for r in res_rows]

    with layer2_csv.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        l2_rows = list(rdr)
    org_l2 = [_norm_orgnr(r.get("orgnr")) for r in l2_rows]

    c_res = Counter(org_res)
    c_l2 = Counter(org_l2)
    if partial_limit is None:
        multiset_ok = c_res == c_l2
        no_extra = set(org_l2) <= set(org_res) and len(org_l2) == len(org_res)
    else:
        multiset_ok = all(c_l2[k] <= c_res[k] for k in c_l2) and not (c_l2 - c_res)
        no_extra = multiset_ok and len(l2_rows) <= len(res_rows)

    zero_pages = 0
    tavily_used = 0
    accept = reject = maybe = 0
    flags_listed: List[Dict[str, Any]] = []
    flags_irrelevant: List[Dict[str, Any]] = []

    for r in l2_rows:
        pfc = r.get("pages_fetched_count", "")
        try:
            pi = int(float(pfc)) if str(pfc).strip() != "" else 0
        except ValueError:
            pi = 0
        if pi == 0:
            zero_pages += 1
        if _parse_bool_cell(r.get("tavily_used", False)):
            tavily_used += 1

        fit = _parse_bool_cell(r.get("is_fit_for_nivo", False))
        try:
            conf = float(r.get("fit_confidence", 0) or 0)
        except ValueError:
            conf = 0.0
        if not fit:
            reject += 1
        elif conf >= 0.55:
            accept += 1
        else:
            maybe += 1

        name = (r.get("company_name") or "").lower()
        org = _norm_orgnr(r.get("orgnr"))
        if org in DEFAULT_MAJOR_ORGNR_DENYLIST:
            flags_listed.append({"orgnr": org, "company_name": r.get("company_name")})
        for kw in DEFAULT_MAJOR_NAME_KEYWORDS:
            if kw and kw.lower() in name:
                flags_listed.append({"orgnr": org, "company_name": r.get("company_name"), "keyword": kw})
                break

        if fit and _parse_bool_cell(r.get("is_hospitality_or_property_company", False)):
            flags_irrelevant.append({"orgnr": org, "flag": "hospitality_or_property_fit_true"})
        if fit and _parse_bool_cell(r.get("is_construction_or_installation", False)):
            flags_irrelevant.append({"orgnr": org, "flag": "construction_fit_true"})
        if fit and _parse_bool_cell(r.get("is_generic_distributor", False)):
            flags_irrelevant.append({"orgnr": org, "flag": "generic_distributor_fit_true"})

    n2 = len(l2_rows)
    zero_pct = (100.0 * zero_pages / n2) if n2 else 0.0
    tavily_pct = (100.0 * tavily_used / n2) if n2 else 0.0

    gate_zero_pages = zero_pct > MAX_ZERO_PAGES_PCT
    ok = multiset_ok and no_extra and not gate_zero_pages

    detail = {
        "layer2_csv": str(layer2_csv),
        "row_count_layer2": n2,
        "row_count_resolved_input": len(org_res),
        "layer2_partial_limit": partial_limit,
        "orgnr_multiset_match": multiset_ok,
        "orgnr_row_count_match": no_extra,
        "pages_fetched_zero_count": zero_pages,
        "pages_fetched_zero_pct": round(zero_pct, 2),
        "gate_zero_pages_pct_le_10": not gate_zero_pages,
        "tavily_used_count": tavily_used,
        "tavily_used_pct": round(tavily_pct, 2),
        "accept_count": accept,
        "reject_count": reject,
        "maybe_count": maybe,
        "flags_large_listed": flags_listed,
        "flags_irrelevant_industry_fit": flags_irrelevant,
    }
    return ok, detail


def main() -> None:
    _load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    ap = argparse.ArgumentParser(description="Controlled Layer 2 pipeline (input-only universe)")
    ap.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Shortlist CSV (default: <repo>/shortlist_200.csv)",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / "layer2_out_200",
        help="Directory for resolver outputs, Layer 2 outputs, and report",
    )
    ap.add_argument("--sleep-resolve", type=float, default=0.25, help="Pause between resolver rows")
    ap.add_argument("--sleep-layer2", type=float, default=0.4, help="Passed to screening_layer2_run --sleep")
    ap.add_argument(
        "--no-default-major-exclusions",
        action="store_true",
        help="Pass --no-default-major-exclusions to resolve_homepages_for_shortlist.py",
    )
    ap.add_argument(
        "--skip-layer2",
        action="store_true",
        help="Only run resolver + resolver validation (for dry runs)",
    )
    ap.add_argument(
        "--layer2-limit",
        type=int,
        default=None,
        help="Forward --limit to screening_layer2_run.py (subset of resolved rows)",
    )
    ap.add_argument(
        "--allow-fixtures-for-dev",
        action="store_true",
        help="Allow --input under scripts/fixtures/layer2_*.csv (never for production)",
    )
    args = ap.parse_args()

    inp = args.input
    if inp is None:
        inp = REPO_ROOT / "shortlist_200.csv"
    inp = inp.resolve()
    if not inp.is_file():
        print(f"Input file not found: {inp}", file=sys.stderr)
        print(
            "Create shortlist_200.csv from Stage 1 only, e.g.:",
            file=sys.stderr,
        )
        print(
            "  PYTHONPATH=. python3 scripts/screening_rank_v1.py --out shortlist_200.csv --top 200",
            file=sys.stderr,
        )
        print("Then inspect orgnr/company_name manually, then run this pipeline without --input.", file=sys.stderr)
        sys.exit(2)

    if not args.allow_fixtures_for_dev and _is_forbidden_layer2_fixture_csv(inp):
        print(f"Forbidden input for production: {inp}", file=sys.stderr)
        print(
            "Do not use scripts/fixtures/layer2_*.csv for real shortlist evaluation. "
            "Generate shortlist_200.csv via scripts/screening_rank_v1.py only.",
            file=sys.stderr,
        )
        print(
            "For local dev smoke tests, pass --allow-fixtures-for-dev together with --input.",
            file=sys.stderr,
        )
        sys.exit(2)

    if not args.allow_fixtures_for_dev:
        logger.info(
            "Production mode: input is not a layer2 fixture (use Stage 1 CSV / shortlist_200.csv)."
        )

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    path_resolved = out_dir / "shortlist_resolved.csv"
    path_excluded = out_dir / "shortlist_excluded.csv"
    path_summary = out_dir / "homepage_resolution_summary.json"
    path_report = out_dir / "controlled_run_report.json"

    with inp.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "orgnr" not in reader.fieldnames or "company_name" not in reader.fieldnames:
            print("CSV must include orgnr and company_name columns.", file=sys.stderr)
            sys.exit(2)
        rows = list(reader)

    py = sys.executable
    logger.info("Controlled pipeline: Step 1 resolve_homepages_for_shortlist.py (%d rows) → %s", len(rows), out_dir)
    resolve_script = REPO_ROOT / "scripts" / "resolve_homepages_for_shortlist.py"
    rcmd = [
        py,
        str(resolve_script),
        "--input",
        str(inp),
        "--out-resolved",
        str(path_resolved),
        "--out-excluded",
        str(path_excluded),
        "--out-summary",
        str(path_summary),
        "--sleep",
        str(args.sleep_resolve),
    ]
    if args.no_default_major_exclusions:
        rcmd.append("--no-default-major-exclusions")
    env = {**os.environ, "PYTHONPATH": str(REPO_ROOT)}
    rr = subprocess.run(rcmd, cwd=str(REPO_ROOT), env=env)
    if rr.returncode != 0:
        print(f"resolve_homepages_for_shortlist.py exited {rr.returncode}", file=sys.stderr)
        sys.exit(3)

    with path_summary.open(encoding="utf-8") as sf:
        summary = json.load(sf)

    with path_resolved.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        resolved = list(rdr)
    with path_excluded.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        excluded = list(rdr)

    res_ok, res_detail = _validate_resolver_outputs(rows, resolved, excluded)
    report: Dict[str, Any] = {
        "input_csv": str(inp),
        "out_dir": str(out_dir),
        "resolver_summary_path": str(path_summary),
        "resolver_validation": res_detail,
        "resolver_validation_ok": res_ok,
    }

    if not res_ok:
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        logger.error("Resolver validation failed (see %s)", path_report)
        sys.exit(3)

    if args.skip_layer2:
        report["layer2_skipped"] = True
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        logger.info("Skip Layer 2; wrote %s", path_report)
        sys.exit(0)

    layer2_script = REPO_ROOT / "scripts" / "screening_layer2_run.py"
    cmd = [
        py,
        str(layer2_script),
        "--input",
        str(path_resolved),
        "--out-dir",
        str(out_dir),
        "--sleep",
        str(args.sleep_layer2),
    ]
    if args.layer2_limit is not None:
        cmd.extend(["--limit", str(args.layer2_limit)])
    logger.info("Running Layer 2: %s", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(REPO_ROOT), env=env)
    if r.returncode != 0:
        report["layer2_subprocess_exit_code"] = r.returncode
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        logger.error("screening_layer2_run.py exited %s", r.returncode)
        sys.exit(3)

    l2_csv = _latest_layer2_csv(out_dir)
    if not l2_csv or not l2_csv.is_file():
        report["layer2_error"] = "no layer2_results_*.csv in out_dir"
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        sys.exit(3)

    l2_ok, l2_detail = _validate_layer2_csv(
        path_resolved, l2_csv, partial_limit=args.layer2_limit
    )
    report["layer2_validation"] = l2_detail
    report["layer2_validation_ok"] = l2_ok
    report["layer2_results_csv"] = str(l2_csv)

    path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if not l2_ok:
        logger.error("Layer 2 output validation failed (see %s)", path_report)
        sys.exit(3)

    logger.info("Controlled pipeline OK. Report: %s", path_report)
    logger.info("Layer 2 CSV: %s", l2_csv)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
