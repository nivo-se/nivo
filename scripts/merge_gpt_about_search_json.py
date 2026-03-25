#!/usr/bin/env python3
"""
Merge two ``gpt_search_about_for_run_batch.py`` output JSON files (concatenate ``items`` and ``batches``).

Usage:
  PYTHONPATH=. python3 scripts/merge_gpt_about_search_json.py \\
    scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_full.json \\
    scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_offset220.json \\
    --out scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_complete.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso


def _rel_repo(p: Path) -> str:
    r = p.resolve()
    try:
        return str(r.relative_to(REPO_ROOT))
    except ValueError:
        return str(r)


def _nonempty(items: List[Dict[str, Any]]) -> int:
    return sum(1 for it in items if (it.get("about_text") or "").strip())


def main() -> None:
    p = argparse.ArgumentParser(description="Merge two GPT about-search batch JSON outputs.")
    p.add_argument("first", type=Path, help="First JSON (earlier offsets)")
    p.add_argument("second", type=Path, help="Second JSON (continuation)")
    p.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Output merged JSON path",
    )
    args = p.parse_args()

    a = json.loads(Path(args.first).read_text(encoding="utf-8"))
    b = json.loads(Path(args.second).read_text(encoding="utf-8"))

    items = list(a.get("items") or []) + list(b.get("items") or [])
    batches_a = list(a.get("batches") or [])
    batches_b = list(b.get("batches") or [])
    n_a = len(batches_a)
    merged_batches: List[Dict[str, Any]] = []
    for x in batches_a:
        merged_batches.append(dict(x))
    for x in batches_b:
        y = dict(x)
        y["batch_index"] = n_a + int(y.get("batch_index", 0))
        y["merge_source"] = "second_file"
        merged_batches.append(y)
    for x in merged_batches[:n_a]:
        x.setdefault("merge_source", "first_file")

    out: Dict[str, Any] = {
        "schema_version": 2,
        "script": "merge_gpt_about_search_json.py",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "run_id": a.get("run_id") or b.get("run_id"),
        "filter": a.get("filter") or b.get("filter"),
        "model": a.get("model") or b.get("model"),
        "max_completion_tokens": a.get("max_completion_tokens") or b.get("max_completion_tokens"),
        "total_eligible_rows": a.get("total_eligible_rows") or b.get("total_eligible_rows"),
        "merged_from": [
            _rel_repo(Path(args.first)),
            _rel_repo(Path(args.second)),
        ],
        "part1_total_items": len(a.get("items") or []),
        "part2_total_items": len(b.get("items") or []),
        "part2_start_offset": b.get("start_offset"),
        "total_items": len(items),
        "achieved_nonempty_about": _nonempty(items),
        "note": a.get("note") or b.get("note"),
        "batches": merged_batches,
        "items": items,
    }

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} — total_items={len(items)} nonempty_about={out['achieved_nonempty_about']}")


if __name__ == "__main__":
    main()
