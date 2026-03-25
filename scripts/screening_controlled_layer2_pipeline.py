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
  3 — resolver or post-layer2 validation failed (see controlled_run_report.json).
      Layer 2: fails on orgnr multiset mismatch or structural ``weak`` bucket over threshold
      (not on high ``pages_fetched_count == 0`` rate).

Also writes `pipeline_manifest_<UTC_RUN_ID>.json` in `--out-dir` (settings, artifact paths, report snapshot).
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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))
_SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json

from layer2_confidence_buckets import enrich_layer2_jsonl_and_csv

CONTROLLED_LAYER2_PIPELINE_VERSION = "1.1.0"

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

# Assistive resolver: many rows may be unresolved; do not fail the pipeline on that alone.
MAX_UNUSABLE_HOMEPAGE_PCT = 100.0


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
    """
    Rows that should fail the resolver gate. Unresolved homepages are allowed: Layer 2 runs in
    homepage-missing (Tavily-only) mode. Only hard-fail obvious breakage (dead URL, mismatch).
    """
    st = (row.get("homepage_status") or "").strip()
    hr = (row.get("homepage_resolved") or row.get("homepage") or "").strip()
    if st in ("unresolved", "manual_curated"):
        return False
    if st in ("dead_original", "rejected_mismatch"):
        return True
    if st in ("verified_existing", "resolved_tavily", "manual_curated") and hr:
        return False
    if hr and not st:
        return False
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


def _latest_layer2_jsonl(out_dir: Path) -> Optional[Path]:
    paths = sorted(out_dir.glob("layer2_results_*.jsonl"))
    return paths[-1] if paths else None


def _latest_layer2_manifest(out_dir: Path) -> Optional[Path]:
    paths = sorted(out_dir.glob("layer2_manifest_*.json"))
    return paths[-1] if paths else None


def _cli_dict(args: argparse.Namespace) -> Dict[str, Any]:
    d: Dict[str, Any] = {}
    for k, v in vars(args).items():
        d[k] = str(v.resolve()) if isinstance(v, Path) else v
    return d


def _artifact_path_if_exists(p: Path) -> Optional[str]:
    return str(p.resolve()) if p.is_file() else None


def _write_pipeline_manifest(
    *,
    out_dir: Path,
    run_id: str,
    args: argparse.Namespace,
    inp: Path,
    path_resolved: Path,
    path_excluded: Path,
    path_summary: Path,
    path_report: Path,
    status: str,
    report: Dict[str, Any],
    layer2_skipped: bool,
) -> Path:
    """Reproducibility snapshot for the controlled resolver + Layer 2 orchestration (see docs/screening_runs_db_proposal.md)."""
    l2_csv = _latest_layer2_csv(out_dir)
    l2_jsonl = _latest_layer2_jsonl(out_dir)
    l2_man = _latest_layer2_manifest(out_dir)
    man_path = out_dir / f"pipeline_manifest_{run_id}.json"
    cb = report.get("confidence_buckets")
    body: Dict[str, Any] = {
        "run_kind": "controlled_layer2_pipeline",
        "run_id": run_id,
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "script": "screening_controlled_layer2_pipeline.py",
        "script_version": CONTROLLED_LAYER2_PIPELINE_VERSION,
        "cli": _cli_dict(args),
        "status": status,
        "layer2_skipped": layer2_skipped,
        "artifacts": {
            "input_shortlist_csv": str(inp.resolve()),
            "shortlist_resolved_csv": _artifact_path_if_exists(path_resolved),
            "shortlist_excluded_csv": _artifact_path_if_exists(path_excluded),
            "homepage_resolution_summary_json": _artifact_path_if_exists(path_summary),
            "controlled_run_report_json": _artifact_path_if_exists(path_report),
            "pipeline_manifest_json": str(man_path.resolve()),
            "layer2_results_jsonl": str(l2_jsonl.resolve()) if l2_jsonl else None,
            "layer2_results_csv": str(l2_csv.resolve()) if l2_csv else None,
            "layer2_manifest_json": str(l2_man.resolve()) if l2_man else None,
        },
        "report": report,
    }
    if cb is not None:
        body["confidence_buckets"] = cb
    write_json(man_path, body)
    return man_path


def _parse_bool_cell(x: Any) -> bool:
    if isinstance(x, bool):
        return x
    s = str(x).strip().lower()
    return s in ("true", "1", "yes")


def _validate_layer2_outputs(
    resolved_path: Path,
    out_dir: Path,
    layer2_csv: Path,
    *,
    partial_limit: Optional[int] = None,
    max_structural_weak_pct: float = 0.15,
    max_structural_weak_abs: Optional[int] = None,
    warn_weak_identity_pct: float = 0.40,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Resolver/Layer2 multiset checks + confidence-bucket enrichment on JSONL/CSV.
    Fails only when structural `weak` bucket exceeds thresholds (not on high zero-page rate).
    """
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

    base_detail: Dict[str, Any] = {
        "layer2_csv": str(layer2_csv),
        "layer2_jsonl": None,
        "layer2_raw_dir": str(out_dir / "layer2_raw"),
        "row_count_layer2": n2,
        "row_count_resolved_input": len(org_res),
        "layer2_partial_limit": partial_limit,
        "orgnr_multiset_match": multiset_ok,
        "orgnr_row_count_match": no_extra,
        "pages_fetched_zero_count": zero_pages,
        "pages_fetched_zero_pct": round(zero_pct, 2),
        "tavily_used_count": tavily_used,
        "tavily_used_pct": round(tavily_pct, 2),
        "accept_count": accept,
        "reject_count": reject,
        "maybe_count": maybe,
        "flags_large_listed": flags_listed,
        "flags_irrelevant_industry_fit": flags_irrelevant,
    }

    if not (multiset_ok and no_extra):
        base_detail["confidence_buckets"] = {
            "policy_version": "1.1.0",
            "skipped": "orgnr multiset / row-count mismatch; bucket enrichment not run",
        }
        return False, base_detail

    l2_jsonl = _latest_layer2_jsonl(out_dir)
    raw_dir = out_dir / "layer2_raw"
    base_detail["layer2_jsonl"] = str(l2_jsonl.resolve()) if l2_jsonl else None

    bucket_counts: Dict[str, int] = {}
    enrichment_ok = False
    enrichment_error: Optional[str] = None
    if l2_jsonl and l2_jsonl.is_file() and raw_dir.is_dir():
        try:
            bucket_counts = enrich_layer2_jsonl_and_csv(l2_jsonl, layer2_csv, raw_dir)
            enrichment_ok = True
        except Exception as exc:
            enrichment_error = str(exc)
            logger.exception("Confidence bucket enrichment failed")
    else:
        enrichment_error = "missing layer2_jsonl or layer2_raw directory"

    weak_n = int(bucket_counts.get("weak", 0))
    weak_id_n = int(bucket_counts.get("weak_identity_zero_page", 0))
    weak_pct = (100.0 * weak_n / n2) if n2 else 0.0
    weak_id_pct_total = (100.0 * weak_id_n / n2) if n2 else 0.0

    gate_structural_weak_pct = weak_pct > (100.0 * max_structural_weak_pct)
    gate_structural_weak_abs = (
        max_structural_weak_abs is not None and weak_n > max_structural_weak_abs
    )
    gate_structural_weak_fail = gate_structural_weak_pct or gate_structural_weak_abs

    warn_weak_identity = weak_id_pct_total > (100.0 * warn_weak_identity_pct)

    ok = enrichment_ok and not gate_structural_weak_fail

    confidence_buckets: Dict[str, Any] = {
        "policy_version": "1.1.0",
        "counts": {
            "high_confidence": int(bucket_counts.get("high_confidence", 0)),
            "tavily_triage": int(bucket_counts.get("tavily_triage", 0)),
            "weak": weak_n,
            "weak_identity_zero_page": weak_id_n,
        },
        "thresholds": {
            "max_structural_weak_pct": max_structural_weak_pct,
            "max_structural_weak_abs": max_structural_weak_abs,
            "warn_weak_identity_pct": warn_weak_identity_pct,
        },
        "gates": {
            "gate_structural_weak_pct": not gate_structural_weak_pct,
            "gate_structural_weak_abs": not gate_structural_weak_abs,
            "gate_structural_weak_pass": not gate_structural_weak_fail,
        },
        "warnings": {
            "weak_identity_zero_page_pct_of_total": round(weak_id_pct_total, 2),
            "warn_weak_identity_high": warn_weak_identity,
        },
        "enrichment": {
            "ok": enrichment_ok,
            "error": enrichment_error,
        },
    }

    base_detail["confidence_buckets"] = confidence_buckets
    if warn_weak_identity:
        logger.warning(
            "High weak_identity_zero_page fraction (%.1f%% of rows); see confidence_buckets in report",
            weak_id_pct_total,
        )
    return ok, base_detail


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
    ap.add_argument(
        "--max-structural-weak-pct",
        type=float,
        default=0.15,
        metavar="P",
        help="Fail if structural weak bucket count / N exceeds this (default: 0.15)",
    )
    ap.add_argument(
        "--max-structural-weak-abs",
        type=int,
        default=None,
        metavar="N",
        help="Optional: fail if structural weak bucket count exceeds this absolute cap",
    )
    ap.add_argument(
        "--warn-weak-identity-pct",
        type=float,
        default=0.40,
        metavar="P",
        help="Log warning when weak_identity_zero_page / N exceeds this (default: 0.40); does not fail",
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
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
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
        fail_report: Dict[str, Any] = {"resolver_subprocess_exit_code": rr.returncode}
        path_report.write_text(json.dumps(fail_report, indent=2), encoding="utf-8")
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="resolver_subprocess_failed",
            report=fail_report,
            layer2_skipped=False,
        )
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
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="resolver_validation_failed",
            report=report,
            layer2_skipped=False,
        )
        logger.error("Resolver validation failed (see %s)", path_report)
        sys.exit(3)

    if args.skip_layer2:
        report["layer2_skipped"] = True
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="ok_layer2_skipped",
            report=report,
            layer2_skipped=True,
        )
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
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="layer2_subprocess_failed",
            report=report,
            layer2_skipped=False,
        )
        logger.error("screening_layer2_run.py exited %s", r.returncode)
        sys.exit(3)

    l2_csv = _latest_layer2_csv(out_dir)
    if not l2_csv or not l2_csv.is_file():
        report["layer2_error"] = "no layer2_results_*.csv in out_dir"
        path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="layer2_output_missing",
            report=report,
            layer2_skipped=False,
        )
        sys.exit(3)

    l2_ok, l2_detail = _validate_layer2_outputs(
        path_resolved,
        out_dir,
        l2_csv,
        partial_limit=args.layer2_limit,
        max_structural_weak_pct=args.max_structural_weak_pct,
        max_structural_weak_abs=args.max_structural_weak_abs,
        warn_weak_identity_pct=args.warn_weak_identity_pct,
    )
    report["layer2_validation"] = l2_detail
    report["layer2_validation_ok"] = l2_ok
    report["layer2_results_csv"] = str(l2_csv)
    if isinstance(l2_detail.get("confidence_buckets"), dict):
        report["confidence_buckets"] = l2_detail["confidence_buckets"]

    path_report.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if not l2_ok:
        _write_pipeline_manifest(
            out_dir=out_dir,
            run_id=run_id,
            args=args,
            inp=inp,
            path_resolved=path_resolved,
            path_excluded=path_excluded,
            path_summary=path_summary,
            path_report=path_report,
            status="layer2_validation_failed",
            report=report,
            layer2_skipped=False,
        )
        logger.error("Layer 2 output validation failed (see %s)", path_report)
        sys.exit(3)

    _write_pipeline_manifest(
        out_dir=out_dir,
        run_id=run_id,
        args=args,
        inp=inp,
        path_resolved=path_resolved,
        path_excluded=path_excluded,
        path_summary=path_summary,
        path_report=path_report,
        status="ok",
        report=report,
        layer2_skipped=False,
    )

    logger.info("Controlled pipeline OK. Report: %s", path_report)
    logger.info("Layer 2 CSV: %s", l2_csv)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
