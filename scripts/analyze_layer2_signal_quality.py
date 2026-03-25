#!/usr/bin/env python3
"""
Analyze signal quality for an existing Layer 2 run (no retrieval changes).

Reads layer2_results CSV + JSONL and Tavily raw JSON under layer2_raw/, splits by
pages_fetched_count, and summarizes Tavily/domain/identity/classifier signals for zero-page rows.

Example:
  PYTHONPATH=. python3 scripts/analyze_layer2_signal_quality.py \\
    --csv layer2_out_200/layer2_results_20260324T195338Z.csv \\
    --jsonl layer2_out_200/layer2_results_20260324T195338Z.jsonl \\
    --layer2-raw-dir layer2_out_200/layer2_raw \\
    --out-prefix layer2_out_200/signal_quality_20260324T195338Z
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

# Domains that are usually directory / social / media (not "company homepage" signal).
_DIRECTORY_MEDIA_SUBSTR = (
    "linkedin.com",
    "facebook.com",
    "crunchbase.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "wikipedia.org",
    "wikidata.org",
    "allabolag.se",
    "proff.se",
    "kompass.com",
    "bizzdo.se",
    "ratsit",
    "merinfo",
    "bolagsfakta",
    "hitta.se",
    "eniro.se",
    "eniro.",
    "yelp.com",
    "google.com",
    "bing.com",
    "duckduckgo",
    "amazon.",
    "ebay.",
    "pinterest.",
    "reddit.com",
    "medium.com",
    "scribd.com",
)


def _norm_host(url: str) -> str:
    if not url or not str(url).strip():
        return ""
    try:
        p = urlparse(url if "://" in url else f"https://{url}")
        h = (p.netloc or "").lower()
        if h.startswith("www."):
            h = h[4:]
        return h
    except Exception:
        return ""


def _domain_from_result(r: Dict[str, Any]) -> str:
    return _norm_host(str(r.get("url") or ""))


def _snippet_len(r: Dict[str, Any]) -> int:
    c = r.get("content")
    return len(str(c)) if c is not None else 0


def looks_like_company_domain(host: str) -> bool:
    if not host:
        return False
    h = host.lower()
    return not any(bad in h for bad in _DIRECTORY_MEDIA_SUBSTR)


def parse_bool_cell(x: Any) -> Optional[bool]:
    if isinstance(x, bool):
        return x
    s = str(x).strip().lower()
    if s in ("true", "1", "yes"):
        return True
    if s in ("false", "0", "no"):
        return False
    return None


def to_float(x: Any) -> Optional[float]:
    try:
        return float(str(x).strip())
    except Exception:
        return None


def to_int(x: Any) -> int:
    try:
        return int(float(str(x).strip()))
    except Exception:
        return 0


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if isinstance(obj, dict):
                rows.append(obj)
    return rows


def read_csv_rows(path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    with path.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        fields = list(rdr.fieldnames or [])
        rows = [dict(x) for x in rdr]
    return fields, rows


def load_tavily_results_from_artifacts(
    raw_dir: Path,
    orgnr: str,
    tavily_raw_artifacts: Any,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Load all Tavily `results` entries from raw JSON files for this org.
    Returns (flattened results sorted by score desc, list of files used).
    """
    files_used: List[str] = []
    all_results: List[Dict[str, Any]] = []

    paths: List[Path] = []
    if isinstance(tavily_raw_artifacts, dict):
        for rel in tavily_raw_artifacts.values():
            if not rel:
                continue
            name = Path(str(rel)).name
            p = raw_dir / name
            if p.is_file():
                paths.append(p)
    if not paths:
        for pat in ("__primary_search.json", "__identity_search.json"):
            p = raw_dir / f"{orgnr}{pat}"
            if p.is_file():
                paths.append(p)

    seen: set = set()
    for p in paths:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        files_used.append(str(p.name))
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        tr = data.get("tavily_response") or {}
        for r in tr.get("results") or []:
            if isinstance(r, dict):
                all_results.append(r)

    all_results.sort(key=lambda r: float(r.get("score") or 0.0), reverse=True)
    return all_results, files_used


def analyze_tavily_block(results: List[Dict[str, Any]], first_party: Optional[str]) -> Dict[str, Any]:
    n = len(results)
    domains = [_domain_from_result(r) for r in results]
    domains = [d for d in domains if d]
    unique_domains = sorted(set(domains))
    snippet_lens = [_snippet_len(r) for r in results]
    avg_snip = (sum(snippet_lens) / len(snippet_lens)) if snippet_lens else 0.0

    top_domain = ""
    if results:
        best = max(results, key=lambda r: float(r.get("score") or 0.0))
        top_domain = _domain_from_result(best)

    count_from_top = sum(1 for d in domains if d == top_domain) if top_domain else 0

    fp_norm = ""
    if first_party:
        fp_norm = first_party.lower().strip()
        if fp_norm.startswith("www."):
            fp_norm = fp_norm[4:]

    fp_in_results = False
    if fp_norm:
        for d in domains:
            if d == fp_norm or d.endswith("." + fp_norm) or (fp_norm in d and len(fp_norm) >= 4):
                fp_in_results = True
                break

    first_party_matches_top = bool(
        fp_norm and top_domain and (fp_norm == top_domain or top_domain.endswith("." + fp_norm))
    )

    return {
        "tavily_result_count": n,
        "tavily_unique_domains_count": len(unique_domains),
        "tavily_unique_domains": "|".join(unique_domains[:20]) + ("..." if len(unique_domains) > 20 else ""),
        "top_result_domain": top_domain,
        "result_count_from_top_domain": count_from_top,
        "avg_snippet_length": round(avg_snip, 1),
        "first_party_domain": fp_norm,
        "first_party_in_tavily_results": fp_in_results,
        "first_party_matches_top_result_domain": first_party_matches_top,
        "first_party_looks_like_company_domain": looks_like_company_domain(fp_norm) if fp_norm else False,
        "top_domain_looks_like_company_domain": looks_like_company_domain(top_domain) if top_domain else False,
    }


def pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * part / whole, 2)


def mean(xs: Sequence[float]) -> float:
    return float(sum(xs) / len(xs)) if xs else 0.0


def median(xs: Sequence[float]) -> float:
    if not xs:
        return 0.0
    return float(statistics.median(xs))


def main() -> int:
    ap = argparse.ArgumentParser(description="Layer 2 signal quality analysis (zero-page focus)")
    ap.add_argument("--csv", type=Path, required=True)
    ap.add_argument("--jsonl", type=Path, required=True)
    ap.add_argument("--layer2-raw-dir", type=Path, required=True, help="Directory with *__primary_search.json etc.")
    ap.add_argument(
        "--out-prefix",
        type=Path,
        default=None,
        help="Output path prefix (writes .json, .md, _zero_page_top30.csv). Default: stem of jsonl in cwd",
    )
    ap.add_argument(
        "--top-n",
        type=int,
        default=30,
        help="Zero-page rows to write in detail CSV (default 30)",
    )
    args = ap.parse_args()

    csv_path = args.csv.resolve()
    jsonl_path = args.jsonl.resolve()
    raw_dir = args.layer2_raw_dir.resolve()
    if not csv_path.is_file() or not jsonl_path.is_file():
        print("CSV or JSONL not found.", file=sys.stderr)
        return 2
    if not raw_dir.is_dir():
        print(f"layer2-raw-dir not a directory: {raw_dir}", file=sys.stderr)
        return 2

    _, csv_rows = read_csv_rows(csv_path)
    jl_rows = read_jsonl(jsonl_path)
    if len(csv_rows) != len(jl_rows):
        print(
            f"Warning: CSV rows ({len(csv_rows)}) != JSONL rows ({len(jl_rows)}); using JSONL as primary.",
            file=sys.stderr,
        )

    rows = jl_rows
    n = len(rows)

    gt0: List[Dict[str, Any]] = []
    z0: List[Dict[str, Any]] = []
    for r in rows:
        p = to_int(r.get("pages_fetched_count"))
        if p > 0:
            gt0.append(r)
        else:
            z0.append(r)

    nz = len(z0)
    identity_low_false = sum(
        1 for r in z0 if parse_bool_cell(r.get("layer2_identity_confidence_low")) is False
    )
    identity_low_true = sum(1 for r in z0 if parse_bool_cell(r.get("layer2_identity_confidence_low")) is True)

    fit_ge = sum(
        1
        for r in z0
        if (to_float(r.get("fit_confidence")) or 0.0) >= 0.4
    )
    reason_nonempty = sum(
        1 for r in z0 if str(r.get("reason_summary") or "").strip()
    )

    # Per-row Tavily metrics for zero-page
    z_metrics: List[Dict[str, Any]] = []
    for r in z0:
        org = str(r.get("orgnr") or "").strip()
        lfp = r.get("likely_first_party_domains")
        fp0 = ""
        if isinstance(lfp, list) and lfp:
            fp0 = str(lfp[0] or "").strip()
        elif isinstance(lfp, str) and lfp.strip():
            fp0 = lfp.strip()

        arts = r.get("tavily_raw_artifacts")
        if isinstance(arts, str) and arts.strip().startswith("{"):
            try:
                arts = json.loads(arts.replace("'", '"'))
            except Exception:
                pass

        tav_results, files_used = load_tavily_results_from_artifacts(raw_dir, org, arts)
        block = analyze_tavily_block(tav_results, fp0 or None)
        block["orgnr"] = org
        block["company_name"] = r.get("company_name", "")
        block["pages_fetched_count"] = to_int(r.get("pages_fetched_count"))
        block["layer2_identity_confidence_low"] = r.get("layer2_identity_confidence_low", "")
        block["fit_confidence"] = r.get("fit_confidence", "")
        block["reason_summary_nonempty"] = bool(str(r.get("reason_summary") or "").strip())
        block["stage1_total_score"] = to_float(r.get("stage1_total_score"))
        block["blended_score"] = to_float(r.get("blended_score"))
        block["tavily_raw_files_used"] = "|".join(files_used)
        z_metrics.append(block)

    # Aggregate Tavily stats across zero-page rows
    tr_counts = [float(m["tavily_result_count"]) for m in z_metrics]
    uq_counts = [float(m["tavily_unique_domains_count"]) for m in z_metrics]
    avg_snips = [float(m["avg_snippet_length"]) for m in z_metrics]
    fp_in = sum(1 for m in z_metrics if m["first_party_in_tavily_results"])
    fp_match_top = sum(1 for m in z_metrics if m["first_party_matches_top_result_domain"])
    fp_company = sum(1 for m in z_metrics if m["first_party_looks_like_company_domain"])
    top_dom_company = sum(1 for m in z_metrics if m["top_domain_looks_like_company_domain"])

    summary: Dict[str, Any] = {
        "input": {
            "csv": str(csv_path),
            "jsonl": str(jsonl_path),
            "layer2_raw_dir": str(raw_dir),
        },
        "row_counts": {
            "total": n,
            "pages_fetched_count_gt_0": len(gt0),
            "pages_fetched_count_eq_0": nz,
            "pct_zero_pages": pct(nz, n),
        },
        "zero_page_tavily_aggregates": {
            "tavily_result_count_mean": round(mean(tr_counts), 2),
            "tavily_result_count_median": round(median(tr_counts), 2),
            "unique_domains_per_row_mean": round(mean(uq_counts), 2),
            "unique_domains_per_row_median": round(median(uq_counts), 2),
            "avg_snippet_length_mean": round(mean(avg_snips), 2),
            "rows_first_party_domain_in_tavily_results": fp_in,
            "pct_first_party_in_tavily_results": pct(fp_in, nz),
            "rows_first_party_matches_top_result_domain": fp_match_top,
            "pct_first_party_matches_top_result_domain": pct(fp_match_top, nz),
            "rows_first_party_looks_like_company_domain": fp_company,
            "rows_top_domain_looks_like_company_domain": top_dom_company,
        },
        "zero_page_identity_vs_retrieval": {
            "identity_confidence_low_false": identity_low_false,
            "identity_confidence_low_true": identity_low_true,
            "note": "layer2_identity_confidence_low from JSONL; false = higher identity confidence",
        },
        "zero_page_classifier_signal": {
            "fit_confidence_gte_0_4": fit_ge,
            "pct_fit_confidence_gte_0_4": pct(fit_ge, nz),
            "nonempty_reason_summary": reason_nonempty,
            "pct_nonempty_reason_summary": pct(reason_nonempty, nz),
        },
        "interpretation_hints": {
            "zero_pages_with_rich_tavily": "See per-row tavily_result_count; high counts + first_party_in_tavily suggest retrieval failed later (fetch), not search.",
            "low_information": "Rows with very few Tavily results and first_party not in results are weaker for any downstream use.",
        },
    }

    out_prefix = args.out_prefix
    if out_prefix is None:
        out_prefix = jsonl_path.parent / f"signal_quality_{jsonl_path.stem}"
    else:
        out_prefix = out_prefix.resolve()
        out_prefix.parent.mkdir(parents=True, exist_ok=True)

    json_path = Path(str(out_prefix) + ".json")
    md_path = Path(str(out_prefix) + ".md")
    csv_out = Path(str(out_prefix) + "_zero_page_top.csv")

    json_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Top N zero-page: sort by stage1 desc, then tavily result count desc
    z_sorted = sorted(
        z_metrics,
        key=lambda m: (
            -(m.get("stage1_total_score") or 0.0) if m.get("stage1_total_score") is not None else 0.0,
            -m["tavily_result_count"],
            str(m.get("orgnr") or ""),
        ),
    )[: max(0, args.top_n)]

    fieldnames = [
        "orgnr",
        "company_name",
        "stage1_total_score",
        "blended_score",
        "pages_fetched_count",
        "layer2_identity_confidence_low",
        "fit_confidence",
        "reason_summary_nonempty",
        "tavily_result_count",
        "tavily_unique_domains_count",
        "tavily_unique_domains",
        "top_result_domain",
        "result_count_from_top_domain",
        "avg_snippet_length",
        "first_party_domain",
        "first_party_in_tavily_results",
        "first_party_matches_top_result_domain",
        "first_party_looks_like_company_domain",
        "top_domain_looks_like_company_domain",
        "tavily_raw_files_used",
    ]
    with csv_out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for m in z_sorted:
            row = {k: m.get(k, "") for k in fieldnames}
            w.writerow(row)

    md_lines = [
        "# Layer 2 signal quality (zero-page focus)",
        "",
        f"- **CSV:** `{csv_path.name}`",
        f"- **JSONL:** `{jsonl_path.name}`",
        f"- **Tavily raw:** `{raw_dir.name}/`",
        "",
        "## Split",
        "",
        f"| Bucket | Count | % of total |",
        f"|--------|------:|-----------:|",
        f"| `pages_fetched_count` > 0 | {len(gt0)} | {pct(len(gt0), n)} |",
        f"| `pages_fetched_count` == 0 | {nz} | {pct(nz, n)} |",
        "",
        "## Zero-page rows — Tavily (aggregated)",
        "",
        f"- Mean / median Tavily results per row: **{summary['zero_page_tavily_aggregates']['tavily_result_count_mean']}** / **{summary['zero_page_tavily_aggregates']['tavily_result_count_median']}**",
        f"- Mean / median unique domains per row: **{summary['zero_page_tavily_aggregates']['unique_domains_per_row_mean']}** / **{summary['zero_page_tavily_aggregates']['unique_domains_per_row_median']}**",
        f"- Mean avg snippet length (per row): **{summary['zero_page_tavily_aggregates']['avg_snippet_length_mean']}**",
        f"- `likely_first_party_domains[0]` appears in Tavily results: **{fp_in} / {nz}** ({pct(fp_in, nz)}%)",
        f"- First-party domain matches top-result domain: **{fp_match_top} / {nz}** ({pct(fp_match_top, nz)}%)",
        f"- First-party domain heuristic “company-like”: **{fp_company} / {nz}**",
        f"- Top-result domain heuristic “company-like”: **{top_dom_company} / {nz}**",
        "",
        "## Zero-page — identity vs retrieval",
        "",
        f"- `layer2_identity_confidence_low` == false: **{identity_low_false}**",
        f"- `layer2_identity_confidence_low` == true: **{identity_low_true}**",
        "",
        "## Zero-page — classifier",
        "",
        f"- `fit_confidence` ≥ 0.4: **{fit_ge}** ({pct(fit_ge, nz)}%)",
        f"- Non-empty `reason_summary`: **{reason_nonempty}** ({pct(reason_nonempty, nz)}%)",
        "",
        f"## Top {len(z_sorted)} zero-page rows (detail CSV)",
        "",
        f"Written to `{csv_out.name}` (sorted by stage1 score desc, then Tavily result count).",
        "",
        "Full metrics: see JSON.",
        "",
    ]
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Wrote {csv_out} ({len(z_sorted)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
