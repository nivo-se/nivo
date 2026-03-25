#!/usr/bin/env python3
"""
Drop GPT about-search items that are incomplete (no usable about text or missing evidence fields).

Default rules (strict):
  - ``orgnr``, ``company_name``, ``official_website_url`` (https/http) non-empty
  - ``about_text`` length >= ``--min-about-chars`` (default 20)
  - ``about_source_url`` non-empty https/http
  - ``source_note`` non-empty
  - ``confidence_0_1`` present and > 0

``batches`` from batch runs are omitted in the output (item-level data only).

Usage:
  PYTHONPATH=. python3 scripts/clean_gpt_about_search_json.py \\
    scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_complete.json \\
    --out scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_complete_clean.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso


def _http_url(s: str) -> bool:
    t = (s or "").strip()
    return t.startswith("https://") or t.startswith("http://")


def is_complete(
    item: Dict[str, Any],
    *,
    min_about_chars: int,
) -> Tuple[bool, str]:
    if not (item.get("orgnr") or "").strip():
        return False, "missing_orgnr"
    if not (item.get("company_name") or "").strip():
        return False, "missing_company_name"
    if not _http_url(item.get("official_website_url") or ""):
        return False, "missing_or_bad_official_website_url"
    about = (item.get("about_text") or "").strip()
    if len(about) < min_about_chars:
        return False, "about_text_too_short_or_empty"
    if not _http_url(item.get("about_source_url") or ""):
        return False, "missing_or_bad_about_source_url"
    if not (item.get("source_note") or "").strip():
        return False, "missing_source_note"
    try:
        c = float(item.get("confidence_0_1"))
    except (TypeError, ValueError):
        return False, "bad_confidence"
    if c <= 0:
        return False, "confidence_not_positive"
    return True, "ok"


def main() -> None:
    p = argparse.ArgumentParser(description="Filter GPT about-search JSON to complete items only.")
    p.add_argument("input", type=Path, help="Merged JSON with items[]")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument(
        "--min-about-chars",
        type=int,
        default=20,
        help="Minimum stripped length for about_text (default 20)",
    )
    args = p.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    items: List[Dict[str, Any]] = list(data.get("items") or [])

    kept: List[Dict[str, Any]] = []
    drop_reasons: Dict[str, int] = {}
    for it in items:
        ok, reason = is_complete(it, min_about_chars=args.min_about_chars)
        if ok:
            kept.append(it)
        else:
            drop_reasons[reason] = drop_reasons.get(reason, 0) + 1

    out: Dict[str, Any] = {
        "schema_version": 3,
        "script": "clean_gpt_about_search_json.py",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "run_id": data.get("run_id"),
        "filter": data.get("filter"),
        "model": data.get("model"),
        "source_file": str(Path(args.input).resolve()),
        "min_about_chars": args.min_about_chars,
        "total_items_in": len(items),
        "items_kept": len(kept),
        "items_removed": len(items) - len(kept),
        "drop_reasons": drop_reasons,
        "note": (
            "Items must have non-empty about_text, https about_source_url, source_note, "
            "and confidence_0_1 > 0. Batch-level `batches` array is omitted."
        ),
        "items": kept,
    }

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {out_path} — kept {len(kept)} / {len(items)} "
        f"(removed {len(items) - len(kept)})"
    )


if __name__ == "__main__":
    main()
