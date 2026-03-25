#!/usr/bin/env python3
"""
Split an existing Layer 2 run into confidence buckets (no retrieval changes).

Produces high_confidence, tavily_triage, weak_rows CSVs plus summary JSON/Markdown
with counts, fit breakdown, mean blended score, and top-30 lists.

Uses layer2_confidence_buckets.py (same rules as screening_controlled_layer2_pipeline).

Example:
  PYTHONPATH=. python3 scripts/layer2_confidence_bucket_split.py \\
    --jsonl layer2_out_200/layer2_results_20260324T195338Z.jsonl \\
    --layer2-raw-dir layer2_out_200/layer2_raw \\
    --out-dir layer2_out_200/confidence_buckets
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Import Tavily helpers from sibling script
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from analyze_layer2_signal_quality import parse_bool_cell, read_jsonl, to_float, to_int  # noqa: E402

from layer2_confidence_buckets import (  # noqa: E402
    build_tavily_block,
    classify_confidence_bucket,
)


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


def write_bucket_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    keys = sorted({k for row in rows for k in row.keys()})
    flat = [row_to_csv_flat(r) for r in rows]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        for r in flat:
            w.writerow({k: r.get(k, "") for k in keys})


def fit_bool(r: Dict[str, Any]) -> Optional[bool]:
    return parse_bool_cell(r.get("is_fit_for_nivo"))


def bucket_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    n = len(rows)
    fit_t = sum(1 for r in rows if fit_bool(r) is True)
    fit_f = sum(1 for r in rows if fit_bool(r) is False)
    fit_u = sum(1 for r in rows if fit_bool(r) is None)
    blends = [to_float(r.get("blended_score")) for r in rows]
    blends = [b for b in blends if b is not None]
    mean_b = sum(blends) / len(blends) if blends else None
    return {
        "count": n,
        "fit_true": fit_t,
        "fit_false": fit_f,
        "fit_unknown": fit_u,
        "avg_blended_score": round(mean_b, 4) if mean_b is not None else None,
    }


def top_companies(rows: List[Dict[str, Any]], limit: int = 30) -> List[Dict[str, Any]]:
    def key(r: Dict[str, Any]) -> Tuple[float, float, str]:
        b = to_float(r.get("blended_score"))
        s1 = to_float(r.get("stage1_total_score"))
        return (
            -(b if b is not None else -1.0),
            -(s1 if s1 is not None else -1.0),
            str(r.get("orgnr") or ""),
        )

    s = sorted(rows, key=key)
    out = []
    for r in s[:limit]:
        out.append(
            {
                "orgnr": r.get("orgnr", ""),
                "company_name": r.get("company_name", ""),
                "blended_score": to_float(r.get("blended_score")),
                "stage1_total_score": to_float(r.get("stage1_total_score")),
                "is_fit_for_nivo": r.get("is_fit_for_nivo"),
                "pages_fetched_count": to_int(r.get("pages_fetched_count")),
                "layer2_identity_confidence_low": r.get("layer2_identity_confidence_low"),
            }
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Layer 2 confidence bucket split + summary")
    ap.add_argument("--jsonl", type=Path, required=True)
    ap.add_argument("--layer2-raw-dir", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--top-n", type=int, default=30, help="Top companies listed in summary")
    args = ap.parse_args()

    jsonl_path = args.jsonl.resolve()
    raw_dir = args.layer2_raw_dir.resolve()
    out_dir = args.out_dir.resolve()
    if not jsonl_path.is_file():
        print(f"Missing JSONL: {jsonl_path}", file=sys.stderr)
        return 2
    if not raw_dir.is_dir():
        print(f"Missing layer2 raw dir: {raw_dir}", file=sys.stderr)
        return 2
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = read_jsonl(jsonl_path)
    n_total = len(rows)

    high: List[Dict[str, Any]] = []
    high_strict: List[Dict[str, Any]] = []
    tavily_triage: List[Dict[str, Any]] = []
    weak_rows: List[Dict[str, Any]] = []
    weak_identity_zero: List[Dict[str, Any]] = []

    for r in rows:
        pages = to_int(r.get("pages_fetched_count"))
        id_low = parse_bool_cell(r.get("layer2_identity_confidence_low"))
        block = build_tavily_block(raw_dir, r)
        lab = classify_confidence_bucket(r, block)

        if pages > 0:
            high.append(r)
            if id_low is False:
                high_strict.append(r)
            continue

        if lab == "tavily_triage":
            tavily_triage.append(r)
        elif lab == "weak":
            weak_rows.append(r)
        elif lab == "weak_identity_zero_page":
            weak_identity_zero.append(r)
        else:
            raise RuntimeError(f"unexpected confidence_bucket label {lab!r} for zero-page row")

    write_bucket_csv(out_dir / "high_confidence.csv", high)
    write_bucket_csv(out_dir / "high_confidence_identity_sure.csv", high_strict)
    write_bucket_csv(out_dir / "tavily_triage.csv", tavily_triage)
    write_bucket_csv(out_dir / "weak_rows.csv", weak_rows)
    write_bucket_csv(out_dir / "weak_identity_zero_page.csv", weak_identity_zero)

    summary: Dict[str, Any] = {
        "input": {"jsonl": str(jsonl_path), "layer2_raw_dir": str(raw_dir)},
        "definitions": {
            "high_confidence": "pages_fetched_count > 0",
            "high_confidence_identity_sure": "pages_fetched_count > 0 AND layer2_identity_confidence_low == false",
            "tavily_triage": "pages_fetched_count == 0 AND tavily_result_count > 0 AND first_party domain in Tavily results AND non-empty reason_summary",
            "weak_rows": "pages_fetched_count == 0 AND NOT (tavily_triage conditions) — missing Tavily results, first-party URL miss, or empty reason_summary",
            "weak_identity_zero_page": "pages_fetched_count == 0 AND layer2_identity_confidence_low == true (monitoring; overlaps tavily_triage)",
        },
        "counts": {
            "total_rows": n_total,
            "high_confidence": len(high),
            "high_confidence_identity_sure": len(high_strict),
            "tavily_triage": len(tavily_triage),
            "weak_rows": len(weak_rows),
            "weak_identity_zero_page": len(weak_identity_zero),
            "zero_page_total": len(tavily_triage) + len(weak_rows) + len(weak_identity_zero),
            "pct_weak_of_total": round(100.0 * len(weak_rows) / n_total, 2) if n_total else 0.0,
            "pct_weak_of_zero_page": round(
                100.0
                * len(weak_rows)
                / max(1, len(tavily_triage) + len(weak_rows) + len(weak_identity_zero)),
                2,
            ),
            "pct_weak_identity_of_total": round(100.0 * len(weak_identity_zero) / n_total, 2)
            if n_total
            else 0.0,
        },
        "stats_by_bucket": {
            "high_confidence": bucket_stats(high),
            "high_confidence_identity_sure": bucket_stats(high_strict),
            "tavily_triage": bucket_stats(tavily_triage),
            "weak_rows": bucket_stats(weak_rows),
            "weak_identity_zero_page": bucket_stats(weak_identity_zero),
        },
        "top_companies": {
            "high_confidence": top_companies(high, args.top_n),
            "tavily_triage": top_companies(tavily_triage, args.top_n),
        },
        "proposed_validation_rule": {
            "summary": "Do not fail the controlled pipeline solely on high pct of pages_fetched_count == 0.",
            "fail_when": [
                "weak_rows_count > N_abs (absolute cap, e.g. 25–40 on a 200-row run), OR",
                "weak_rows_count / total_rows > pct_weak (e.g. 5–15%), OR",
                "weak_rows_count / zero_page_rows > pct_weak_among_zero (e.g. >25%) — optional",
            ],
            "rationale": "weak_rows captures zero-page rows with missing Tavily alignment, no first-party hit in Tavily URLs, or empty reason_summary; triage-quality zero-page rows stay out of this bucket.",
            "secondary_monitoring": "weak_identity_zero_page (identity_low on zero-page rows) can stay high even when weak_rows is 0; use as warning, not automatic fail, unless paired with business rules.",
            "warn_when": [
                "tavily_triage count is small relative to zero-page rows (many companies need better homepages but still have snippet signal).",
                "weak_identity_zero_page / total_rows is high (many uncertain identities despite Tavily snippets).",
            ],
        },
    }

    json_path = out_dir / "confidence_buckets_summary.json"
    md_path = out_dir / "confidence_buckets_summary.md"
    json_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    s = summary["stats_by_bucket"]
    c = summary["counts"]

    def md_stats(name: str, key: str) -> str:
        b = s[key]
        ab = b.get("avg_blended_score")
        ab_s = f"{ab:.2f}" if ab is not None else "n/a"
        return (
            f"| {name} | {b['count']} | {b['fit_true']} | {b['fit_false']} | {ab_s} |"
        )

    md_lines = [
        "# Layer 2 confidence buckets",
        "",
        f"- Source JSONL: `{jsonl_path.name}`",
        f"- Tavily raw: `{raw_dir.name}/`",
        "",
        "## Definitions",
        "",
        "| Bucket | Rule |",
        "|--------|------|",
        "| **high_confidence** | `pages_fetched_count > 0` |",
        "| **high_confidence_identity_sure** | pages > 0 and `layer2_identity_confidence_low == false` |",
        "| **tavily_triage** | zero pages, triage OK, `layer2_identity_confidence_low` not true |",
        "| **weak_rows** | zero pages, not triage (missing Tavily / first-party / reason) |",
        "| **weak_identity_zero_page** | zero pages, triage OK, `layer2_identity_confidence_low == true` |",
        "",
        "## Counts",
        "",
        f"| Metric | Value |",
        f"|--------|------:|",
        f"| Total rows | {c['total_rows']} |",
        f"| high_confidence | {c['high_confidence']} |",
        f"| high_confidence_identity_sure | {c['high_confidence_identity_sure']} |",
        f"| tavily_triage | {c['tavily_triage']} |",
        f"| weak_rows (structural) | {c['weak_rows']} |",
        f"| weak_identity_zero_page | {c['weak_identity_zero_page']} |",
        f"| weak_rows / total | {c['pct_weak_of_total']}% |",
        f"| weak_identity / total | {c['pct_weak_identity_of_total']}% |",
        f"| weak_rows / zero-page | {c['pct_weak_of_zero_page']}% |",
        "",
        "## Fit + blended score by bucket",
        "",
        "| Bucket | Count | Fit True | Fit False | Avg blended |",
        "|--------|------:|---------:|----------:|------------:|",
        md_stats("high_confidence", "high_confidence"),
        md_stats("high_confidence_identity_sure", "high_confidence_identity_sure"),
        md_stats("tavily_triage", "tavily_triage"),
        md_stats("weak_rows", "weak_rows"),
        md_stats("weak_identity_zero_page", "weak_identity_zero_page"),
        "",
        f"## Top {args.top_n} (high_confidence)",
        "",
        "| orgnr | company_name | blended | stage1 | fit |",
        "|-------|--------------|--------:|-------:|-----|",
    ]
    for x in summary["top_companies"]["high_confidence"]:
        md_lines.append(
            f"| {x['orgnr']} | {str(x['company_name'])[:50]} | {x.get('blended_score')} | "
            f"{x.get('stage1_total_score')} | {x.get('is_fit_for_nivo')} |"
        )
    md_lines.extend(
        [
            "",
            f"## Top {args.top_n} (tavily_triage)",
            "",
            "| orgnr | company_name | blended | stage1 | fit |",
            "|-------|--------------|--------:|-------:|-----|",
        ]
    )
    for x in summary["top_companies"]["tavily_triage"]:
        md_lines.append(
            f"| {x['orgnr']} | {str(x['company_name'])[:50]} | {x.get('blended_score')} | "
            f"{x.get('stage1_total_score')} | {x.get('is_fit_for_nivo')} |"
        )

    md_lines.extend(
        [
            "",
            "## Proposed validation rule (replace coarse zero-page % gate)",
            "",
            "- **Do not** fail the run only because many rows have `pages_fetched_count == 0` (Tavily + classifier can still carry triage signal).",
            "- **Do** fail (or block promotion) when **`weak_rows` is too large** — zero-page rows that lack Tavily results, lack first-party domain in Tavily URLs, or lack `reason_summary`.",
            "- Suggested thresholds (tune empirically): `weak_rows / total_rows <= 10–15%` **or** `weak_rows <= 25–40` on a 200-line run; add a **warning** when `tavily_triage` is small vs. zero-page count.",
            "",
            "Full machine-readable rule object: `confidence_buckets_summary.json` → `proposed_validation_rule`.",
            "",
        ]
    )
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"Wrote {out_dir / 'high_confidence.csv'} ({len(high)})")
    print(f"Wrote {out_dir / 'high_confidence_identity_sure.csv'} ({len(high_strict)})")
    print(f"Wrote {out_dir / 'tavily_triage.csv'} ({len(tavily_triage)})")
    print(f"Wrote {out_dir / 'weak_rows.csv'} ({len(weak_rows)})")
    print(f"Wrote {out_dir / 'weak_identity_zero_page.csv'} ({len(weak_identity_zero)})")
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
