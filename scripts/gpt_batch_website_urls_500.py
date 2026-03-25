#!/usr/bin/env python3
"""
One-off: top N ranked companies → fixed number of OpenAI Responses calls (batch_size each).

Default: **500 companies**, **batch_size 25**, **20 calls** (no Tavily).

Per batch writes ``batch_XX/manifest.json``, ``request_companies.json``, ``response_raw.json``,
``parsed.json``. Run root gets ``run_manifest.json``, ``merged_urls.json``, ``merged_urls.csv``.

**Deferred (step 3):** optional follow-up to fetch 1–2 sentence \"about\" text per URL — not
implemented; decide after reviewing merged URLs.

Usage:
  cd /path/to/nivo && PYTHONPATH=. python3 scripts/gpt_batch_website_urls_500.py \\
    --out-dir /tmp/gpt500_urls

  # Custom sizes (must satisfy total = batches * batch_size):
  PYTHONPATH=. python3 scripts/gpt_batch_website_urls_500.py --total 500 --batch-size 25 --out-dir /tmp/out

Requires: OPENAI_API_KEY, openai, pydantic, python-dotenv, httpx (same as gpt_batch_website_retrieval_test).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from screening_manifest_utils import git_commit_hash, sha256_file, utc_timestamp_iso, write_json

from gpt_batch_website_retrieval_test import (
    DEFAULT_CHAT_SEARCH_MODEL,
    DEFAULT_INPUT_POOL,
    DEFAULT_MODEL,
    OpenAIBatchCallError,
    _call_openai_batch,
    _call_openai_batch_chat_search,
    _load_dotenv,
    batch_response_output_text,
    build_request_payload,
    load_ranked_head,
    parse_batch_from_response_text,
    serialize_batch_api_response,
)

from openai import OpenAI
from pydantic import ValidationError

logger = logging.getLogger(__name__)

DEFAULT_TOTAL = 500
DEFAULT_BATCH_SIZE = 25


def _chunks(lst: List[Any], n: int) -> List[List[Any]]:
    return [lst[i : i + n] for i in range(0, len(lst), n)]


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(
        description="500 (or N) ranked companies → fixed OpenAI URL batches (no Tavily)."
    )
    ap.add_argument(
        "--input",
        type=Path,
        nargs="?",
        default=None,
        help="Ranked CSV (default: scripts/fixtures/gpt_website_retrieval_shortlist_pool.csv)",
    )
    ap.add_argument("--total", type=int, default=DEFAULT_TOTAL, help="Number of rows from top of ranking")
    ap.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Companies per API call (default 25)",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        required=True,
        help="Output directory (created if missing)",
    )
    ap.add_argument(
        "--model",
        type=str,
        default=None,
        help="OpenAI model (default: GPT_WEBSITE_RETRIEVAL_MODEL or gpt-5.4-nano; with --chat-search: GPT_CHAT_SEARCH_MODEL or gpt-4o-search-preview)",
    )
    ap.add_argument(
        "--chat-search",
        action="store_true",
        help="Chat Completions + search-preview model (see gpt_batch_website_retrieval_test --chat-search)",
    )
    args = ap.parse_args()

    total = int(args.total)
    batch_size = int(args.batch_size)
    if total < 1 or batch_size < 1:
        raise SystemExit("--total and --batch-size must be >= 1")
    if total % batch_size != 0:
        raise SystemExit(f"--total ({total}) must be divisible by --batch-size ({batch_size})")

    num_batches = total // batch_size

    _load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not str(api_key).strip():
        raise SystemExit("OPENAI_API_KEY is not set")

    if args.chat_search:
        model = (args.model or os.getenv("GPT_CHAT_SEARCH_MODEL") or DEFAULT_CHAT_SEARCH_MODEL).strip()
    else:
        model = (args.model or os.getenv("GPT_WEBSITE_RETRIEVAL_MODEL") or DEFAULT_MODEL).strip()

    inp = (args.input or DEFAULT_INPUT_POOL).resolve()
    if not inp.is_file():
        raise SystemExit(
            f"Input CSV not found: {inp}\n"
            "Generate: PYTHONPATH=. python3 scripts/export_gpt_website_retrieval_pool_csv.py"
        )

    rows = load_ranked_head(inp, total)
    batches_rows = _chunks(rows, batch_size)
    if len(batches_rows) != num_batches:
        raise SystemExit(f"Internal error: expected {num_batches} batches, got {len(batches_rows)}")

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    run_started = utc_timestamp_iso()
    merged_rows: List[Dict[str, Any]] = []
    batch_summaries: List[Dict[str, Any]] = []
    non_empty_urls = 0

    client = OpenAI(api_key=api_key.strip())

    for batch_idx, batch_rows in enumerate(batches_rows):
        sub = out_dir / f"batch_{batch_idx:02d}"
        sub.mkdir(parents=True, exist_ok=True)
        request_companies = build_request_payload(batch_rows)

        batch_manifest = {
            "script": "gpt_batch_website_urls_500.py",
            "run_started_utc": run_started,
            "batch_index": batch_idx,
            "batch_count_total": num_batches,
            "batch_size": batch_size,
            "input_csv": str(inp),
            "input_sha256": sha256_file(inp),
            "model": model,
            "git_commit": git_commit_hash(REPO_ROOT),
            "api": "chat_completions_search" if args.chat_search else "responses_web_search_tool",
        }
        write_json(sub / "manifest.json", batch_manifest)
        write_json(sub / "request_companies.json", {"companies": request_companies})

        logger.info("Batch %d/%d (%d companies) → API …", batch_idx + 1, num_batches, len(request_companies))

        try:
            if args.chat_search:
                response, mode_used, structured_rejection = _call_openai_batch_chat_search(
                    client, model, request_companies
                )
            else:
                response, mode_used, structured_rejection = _call_openai_batch(
                    client, model, request_companies
                )
        except OpenAIBatchCallError as e:
            err_payload = {
                "batch_index": batch_idx,
                "error": str(e),
                "structured_format_rejection": e.structured_rejection,
            }
            write_json(sub / "response_raw.json", err_payload)
            write_json(sub / "parsed.json", {"valid": False, "validation_errors": [str(e)]})
            logger.error("Batch %d failed; stopping (no further batches).", batch_idx)
            raise SystemExit(1) from e

        raw_debug = serialize_batch_api_response(response)
        raw_debug["api_mode"] = mode_used
        raw_debug["structured_format_rejection"] = structured_rejection
        write_json(sub / "response_raw.json", raw_debug)

        text = batch_response_output_text(response) or raw_debug.get("output_text") or ""
        try:
            parsed = parse_batch_from_response_text(text)
        except (json.JSONDecodeError, ValidationError) as e:
            write_json(
                sub / "parsed.json",
                {
                    "valid": False,
                    "validation_errors": [f"{type(e).__name__}: {e}"],
                    "raw_output_excerpt": text[:8000],
                },
            )
            logger.error("Batch %d parse failed; stopping.", batch_idx)
            raise SystemExit(1) from e

        expected_n = len(request_companies)
        got_n = len(parsed.items)
        if got_n != expected_n:
            write_json(
                sub / "parsed.json",
                {
                    "valid": False,
                    "expected_count": expected_n,
                    "returned_count": got_n,
                    "items": [m.model_dump() for m in parsed.items],
                },
            )
            logger.error(
                "Batch %d count mismatch: expected %d, got %d",
                batch_idx,
                expected_n,
                got_n,
            )
            raise SystemExit(1)

        out_parsed = {
            "valid": True,
            "api_mode": mode_used,
            "expected_count": expected_n,
            "returned_count": got_n,
            "count_ok": True,
            "items": [m.model_dump() for m in parsed.items],
        }
        write_json(sub / "parsed.json", out_parsed)

        batch_nonempty = 0
        for j, it in enumerate(parsed.items):
            url = (it.official_website_url or "").strip()
            if url:
                batch_nonempty += 1
                non_empty_urls += 1
            src_row = batch_rows[j] if j < len(batch_rows) else {}
            rank_val = (src_row.get("rank") or src_row.get("Rank") or "").strip()
            merged_rows.append(
                {
                    "batch_index": batch_idx,
                    "rank": rank_val,
                    "orgnr": it.orgnr,
                    "company_name": it.company_name,
                    "official_website_url": it.official_website_url,
                    "confidence_0_1": it.confidence_0_1,
                    "source_note": it.source_note,
                }
            )

        batch_summaries.append(
            {
                "batch_index": batch_idx,
                "api_mode": mode_used,
                "non_empty_url_count": batch_nonempty,
            }
        )
        logger.info(
            "Batch %d/%d done: %d non-empty URLs (cumulative unique rows %d)",
            batch_idx + 1,
            num_batches,
            batch_nonempty,
            len(merged_rows),
        )

    merged_path_json = out_dir / "merged_urls.json"
    merged_path_csv = out_dir / "merged_urls.csv"
    write_json(
        merged_path_json,
        {
            "valid": True,
            "created_at_utc": utc_timestamp_iso(),
            "total_companies": total,
            "batch_size": batch_size,
            "num_batches": num_batches,
            "non_empty_url_count": non_empty_urls,
            "model": model,
            "input_csv": str(inp),
            "rows": merged_rows,
        },
    )

    fieldnames = [
        "batch_index",
        "rank",
        "orgnr",
        "company_name",
        "official_website_url",
        "confidence_0_1",
        "source_note",
    ]
    with merged_path_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in merged_rows:
            w.writerow(r)

    run_manifest = {
        "script": "gpt_batch_website_urls_500.py",
        "created_at_utc": utc_timestamp_iso(),
        "run_started_utc": run_started,
        "git_commit": git_commit_hash(REPO_ROOT),
        "input_csv": str(inp),
        "input_sha256": sha256_file(inp),
        "total_companies": total,
        "batch_size": batch_size,
        "num_batches": num_batches,
        "model": model,
        "api": "chat_completions_search" if args.chat_search else "responses_web_search_tool",
        "non_empty_url_count": non_empty_urls,
        "merged_urls_json": str(merged_path_json),
        "merged_urls_csv": str(merged_path_csv),
        "batches": batch_summaries,
        "deferred_next_step": (
            "Optional: second pass for 1–2 sentence about text per URL (not implemented)."
        ),
    }
    write_json(out_dir / "run_manifest.json", run_manifest)
    logger.info(
        "Finished %d batches. Non-empty URLs: %d / %d. Wrote %s",
        num_batches,
        non_empty_urls,
        total,
        out_dir,
    )


if __name__ == "__main__":
    main()
