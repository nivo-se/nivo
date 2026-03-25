"""
Shared confidence-bucket logic for Layer 2 (Tavily raw + JSONL rows).

Used by screening_controlled_layer2_pipeline.py and layer2_confidence_bucket_split.py.
Does not run retrieval or classification.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from analyze_layer2_signal_quality import (  # noqa: E402
    analyze_tavily_block,
    load_tavily_results_from_artifacts,
    parse_bool_cell,
    read_jsonl,
    to_int,
)


def norm_orgnr(x: Any) -> str:
    return "".join(c for c in str(x or "").strip() if c.isdigit())


def first_party_from_row(r: Dict[str, Any]) -> str:
    lfp = r.get("likely_first_party_domains")
    if isinstance(lfp, list) and lfp:
        return str(lfp[0] or "").strip()
    if isinstance(lfp, str) and lfp.strip():
        return lfp.strip()
    return ""


def normalize_artifacts(r: Dict[str, Any]) -> Any:
    arts = r.get("tavily_raw_artifacts")
    if isinstance(arts, str) and arts.strip().startswith("{"):
        try:
            return json.loads(arts.replace("'", '"'))
        except Exception:
            pass
    return arts


def build_tavily_block(raw_dir: Path, r: Dict[str, Any]) -> Dict[str, Any]:
    org = norm_orgnr(r.get("orgnr"))
    fp = first_party_from_row(r)
    arts = normalize_artifacts(r)
    tav_results, _ = load_tavily_results_from_artifacts(raw_dir, org, arts)
    return analyze_tavily_block(tav_results, fp or None)


def classify_confidence_bucket(r: Dict[str, Any], tavily_block: Dict[str, Any]) -> str:
    """
    Disjoint labels:
    - high_confidence: pages_fetched_count > 0
    - weak: zero pages and NOT (triage: tavily>0, first_party in results, non-empty reason)
    - weak_identity_zero_page: zero pages, triage OK, layer2_identity_confidence_low == true
    - tavily_triage: zero pages, triage OK, identity low is not true
    """
    pages = to_int(r.get("pages_fetched_count"))
    if pages > 0:
        return "high_confidence"

    trc = int(tavily_block.get("tavily_result_count") or 0)
    fp_in = bool(tavily_block.get("first_party_in_tavily_results"))
    reason_ok = bool(str(r.get("reason_summary") or "").strip())
    triage_ok = trc > 0 and fp_in and reason_ok

    if not triage_ok:
        return "weak"

    id_low = parse_bool_cell(r.get("layer2_identity_confidence_low"))
    if id_low is True:
        return "weak_identity_zero_page"
    return "tavily_triage"


def compute_buckets_for_jsonl_rows(rows: List[Dict[str, Any]], raw_dir: Path) -> Tuple[Dict[str, str], Dict[str, int]]:
    """Return (orgnr -> label, label counts)."""
    raw_dir = raw_dir.resolve()
    labels: Dict[str, str] = {}
    counts: Dict[str, int] = {
        "high_confidence": 0,
        "tavily_triage": 0,
        "weak": 0,
        "weak_identity_zero_page": 0,
    }
    for r in rows:
        org = norm_orgnr(r.get("orgnr"))
        if not org:
            continue
        block = build_tavily_block(raw_dir, r)
        lab = classify_confidence_bucket(r, block)
        labels[org] = lab
        counts[lab] = counts.get(lab, 0) + 1
    return labels, counts


def enrich_rows_with_bucket(rows: List[Dict[str, Any]], raw_dir: Path) -> Dict[str, int]:
    """Mutates each row with `confidence_bucket`; returns count by label."""
    counts: Dict[str, int] = {
        "high_confidence": 0,
        "tavily_triage": 0,
        "weak": 0,
        "weak_identity_zero_page": 0,
    }
    for r in rows:
        block = build_tavily_block(raw_dir, r)
        lab = classify_confidence_bucket(r, block)
        r["confidence_bucket"] = lab
        counts[lab] = counts.get(lab, 0) + 1
    return counts


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def row_to_csv_flat(r: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in r.items():
        if isinstance(v, (dict, list)):
            out[k] = json.dumps(v, ensure_ascii=False)
        elif v is None:
            out[k] = ""
        else:
            out[k] = v
    return out


def merge_bucket_into_csv(csv_path: Path, org_to_bucket: Dict[str, str]) -> None:
    """Add confidence_bucket column to Layer 2 CSV, matched by orgnr."""
    with csv_path.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        fieldnames = list(rdr.fieldnames or [])
        rows = list(rdr)
    if "confidence_bucket" not in fieldnames:
        fieldnames.append("confidence_bucket")
    for row in rows:
        o = norm_orgnr(row.get("orgnr"))
        row["confidence_bucket"] = org_to_bucket.get(o, "")
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fieldnames})


def enrich_layer2_jsonl_and_csv(
    jsonl_path: Path,
    csv_path: Path,
    raw_dir: Path,
) -> Dict[str, int]:
    """
    Load JSONL, attach confidence_bucket, rewrite JSONL and CSV.
    Returns label counts.
    """
    rows = read_jsonl(jsonl_path)
    counts = enrich_rows_with_bucket(rows, raw_dir)
    write_jsonl(jsonl_path, rows)
    org_to_bucket = {norm_orgnr(r.get("orgnr")): str(r.get("confidence_bucket", "")) for r in rows}
    merge_bucket_into_csv(csv_path, org_to_bucket)
    return counts
