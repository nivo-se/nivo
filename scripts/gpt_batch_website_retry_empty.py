#!/usr/bin/env python3
"""
Second pass: rows with empty ``official_website_url`` in a prior ``merged_urls.csv``.

Re-fetches using Chat Completions + search-preview (same as ``gpt_batch_website_urls_500.py
--chat-search``), with **smaller batches** and **sleep between calls** to reduce 429s.

Enriches payloads from the **ranked pool CSV** (registry_homepage_url, address_*, nace, …) by orgnr.

Writes ``merged_urls_complete.csv`` + ``merged_urls_complete.json`` (full 500 rows, updates only
where retry returns a non-empty URL).

Usage:
  cd /path/to/nivo && PYTHONPATH=. .venv/bin/python3 scripts/gpt_batch_website_retry_empty.py \\
    --merged-csv scripts/fixtures/gpt_website_retrieval_runs/gpt500_urls_chat_search/merged_urls.csv \\
    --out-dir scripts/fixtures/gpt_website_retrieval_runs/gpt500_urls_chat_search/retry_complete
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json

from gpt_batch_website_retrieval_test import (
    DEFAULT_CHAT_SEARCH_MODEL,
    DEFAULT_INPUT_POOL,
    OpenAIBatchCallError,
    _call_openai_batch_chat_search,
    _load_dotenv,
    _read_csv_rows,
    batch_response_output_text,
    build_request_payload,
    parse_batch_from_response_text,
    serialize_batch_api_response,
)

from openai import OpenAI
from pydantic import ValidationError

logger = logging.getLogger(__name__)


def _norm_orgnr_key(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def _chunks(lst: List[Any], n: int) -> List[List[Any]]:
    return [lst[i : i + n] for i in range(0, len(lst), n)]


def _load_pool_by_orgnr(pool_path: Path) -> Dict[str, Dict[str, str]]:
    rows = _read_csv_rows(pool_path)
    out: Dict[str, Dict[str, str]] = {}
    for r in rows:
        k = _norm_orgnr_key(r.get("orgnr") or "")
        if k:
            out[k] = r
    return out


def _load_merged_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Retry empty URLs from merged_urls.csv (chat-search).")
    ap.add_argument(
        "--merged-csv",
        type=Path,
        required=True,
        help="Prior merged_urls.csv from gpt_batch_website_urls_500.py",
    )
    ap.add_argument(
        "--pool-csv",
        type=Path,
        default=DEFAULT_INPUT_POOL,
        help="Ranked pool CSV for registry/geo columns (default: shortlist pool)",
    )
    ap.add_argument("--out-dir", type=Path, required=True, help="Output directory (created)")
    ap.add_argument("--batch-size", type=int, default=8, help="Companies per API call (default 8)")
    ap.add_argument(
        "--sleep-seconds",
        type=float,
        default=22.0,
        help="Pause between successful batch calls to reduce 429 (default 22)",
    )
    ap.add_argument(
        "--model",
        type=str,
        default=None,
        help=f"Override model (default env GPT_CHAT_SEARCH_MODEL or {DEFAULT_CHAT_SEARCH_MODEL})",
    )
    args = ap.parse_args()

    merged_path = args.merged_csv.resolve()
    pool_path = args.pool_csv.resolve()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not merged_path.is_file():
        raise SystemExit(f"merged csv not found: {merged_path}")
    if not pool_path.is_file():
        raise SystemExit(f"pool csv not found: {pool_path}")

    batch_size = max(1, int(args.batch_size))
    sleep_s = max(0.0, float(args.sleep_seconds))

    _load_dotenv()
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    model = (args.model or os.getenv("GPT_CHAT_SEARCH_MODEL") or DEFAULT_CHAT_SEARCH_MODEL).strip()

    merged_rows = _load_merged_rows(merged_path)
    pool_by_org = _load_pool_by_orgnr(pool_path)

    empty_indices: List[int] = []
    for i, r in enumerate(merged_rows):
        if not (r.get("official_website_url") or "").strip():
            empty_indices.append(i)

    if not empty_indices:
        logger.info("No empty URLs; copying merged to complete outputs.")
        complete = [dict(r) for r in merged_rows]
    else:
        logger.info("Retrying %d rows with empty URL (batch_size=%d, sleep=%ss)", len(empty_indices), batch_size, sleep_s)

        # Rows to send: prefer full pool row for payload, else merged row fields only
        retry_specs: List[Tuple[int, Dict[str, str]]] = []
        for i in empty_indices:
            m = merged_rows[i]
            key = _norm_orgnr_key(m.get("orgnr") or "")
            base = dict(pool_by_org.get(key, {}))
            if not base.get("orgnr"):
                base["orgnr"] = m.get("orgnr") or ""
            if not base.get("company_name"):
                base["company_name"] = m.get("company_name") or ""
            retry_specs.append((i, base))

        client = OpenAI(api_key=api_key)
        batches = _chunks(retry_specs, batch_size)
        run_started = utc_timestamp_iso()
        updates: Dict[int, Dict[str, Any]] = {}
        retry_nonempty = 0

        for bidx, batch in enumerate(batches):
            sub = out_dir / f"retry_batch_{bidx:02d}"
            sub.mkdir(parents=True, exist_ok=True)
            pool_slice = [t[1] for t in batch]
            indices_slice = [t[0] for t in batch]
            request_companies = build_request_payload(pool_slice)

            write_json(
                sub / "manifest.json",
                {
                    "script": "gpt_batch_website_retry_empty.py",
                    "batch_index": bidx,
                    "row_indices": indices_slice,
                    "model": model,
                    "run_started_utc": run_started,
                },
            )
            write_json(sub / "request_companies.json", {"companies": request_companies})

            logger.info(
                "Retry batch %d/%d (%d companies) → API …",
                bidx + 1,
                len(batches),
                len(request_companies),
            )

            try:
                response, mode_used, structured_rejection = _call_openai_batch_chat_search(
                    client, model, request_companies
                )
            except OpenAIBatchCallError as e:
                write_json(
                    sub / "response_raw.json",
                    {"error": str(e), "structured_format_rejection": e.structured_rejection},
                )
                logger.error("Batch %d failed: %s", bidx, e)
                raise SystemExit(1) from e

            raw_debug = serialize_batch_api_response(response)
            raw_debug["api_mode"] = mode_used
            raw_debug["structured_format_rejection"] = structured_rejection
            write_json(sub / "response_raw.json", raw_debug)

            text = batch_response_output_text(response) or raw_debug.get("output_text") or ""
            try:
                parsed = parse_batch_from_response_text(text)
            except (json.JSONDecodeError, TypeError, ValidationError) as e:
                write_json(
                    sub / "parsed.json",
                    {
                        "valid": False,
                        "error": f"{type(e).__name__}: {e}",
                        "raw_excerpt": text[:8000],
                    },
                )
                logger.error("Batch %d parse failed: %s", bidx, e)
                raise SystemExit(1) from e

            if len(parsed.items) != len(request_companies):
                write_json(
                    sub / "parsed.json",
                    {"valid": False, "expected": len(request_companies), "got": len(parsed.items)},
                )
                logger.error(
                    "Batch %d count mismatch: expected %d got %d",
                    bidx,
                    len(request_companies),
                    len(parsed.items),
                )
                raise SystemExit(1)

            write_json(
                sub / "parsed.json",
                {
                    "valid": True,
                    "items": [m.model_dump() for m in parsed.items],
                },
            )

            for j, it in enumerate(parsed.items):
                row_i = indices_slice[j]
                url = (it.official_website_url or "").strip()
                if url:
                    retry_nonempty += 1
                    updates[row_i] = {
                        "official_website_url": it.official_website_url,
                        "confidence_0_1": it.confidence_0_1,
                        "source_note": it.source_note,
                    }

            if bidx < len(batches) - 1 and sleep_s > 0:
                logger.info("Sleeping %.1fs before next batch …", sleep_s)
                time.sleep(sleep_s)

        complete = []
        for i, r in enumerate(merged_rows):
            row = dict(r)
            if i in updates:
                row.update(updates[i])
            complete.append(row)

        write_json(
            out_dir / "retry_stats.json",
            {
                "empty_before": len(empty_indices),
                "retry_batches": len(batches),
                "filled_on_retry": retry_nonempty,
                "still_empty_after": sum(
                    1 for r in complete if not (r.get("official_website_url") or "").strip()
                ),
            },
        )

    non_empty = sum(1 for r in complete if (r.get("official_website_url") or "").strip())
    total = len(complete)

    merged_json_path = out_dir / "merged_urls_complete.json"
    merged_csv_path = out_dir / "merged_urls_complete.csv"

    write_json(
        merged_json_path,
        {
            "valid": True,
            "created_at_utc": utc_timestamp_iso(),
            "source_merged_csv": str(merged_path),
            "pool_csv": str(pool_path),
            "total_companies": total,
            "non_empty_url_count": non_empty,
            "model": model,
            "api": "chat_completions_search_retry_empty",
            "rows": complete,
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
    with merged_csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in complete:
            w.writerow(r)

    write_json(
        out_dir / "retry_run_manifest.json",
        {
            "script": "gpt_batch_website_retry_empty.py",
            "created_at_utc": utc_timestamp_iso(),
            "git_commit": git_commit_hash(REPO_ROOT),
            "prior_merged_csv": str(merged_path),
            "pool_csv": str(pool_path),
            "out_complete_csv": str(merged_csv_path),
            "model": model,
            "batch_size": batch_size,
            "sleep_seconds": sleep_s,
            "total_rows": total,
            "non_empty_url_count": non_empty,
        },
    )

    logger.info(
        "Complete set: %d / %d non-empty URLs. Wrote %s and %s",
        non_empty,
        total,
        merged_csv_path,
        merged_json_path,
    )


if __name__ == "__main__":
    main()
