#!/usr/bin/env python3
"""
Run GPT web-search About extraction in batches until we have enough usable rows.

Default: ``--filter gpt_url`` (non-empty ``gpt_official_website_url`` only). Stops when
``--target-min-nonempty-about`` (default 100) items have non-empty ``about_text``, or the DB is
exhausted, or ``--max-batches`` is hit.

One OpenAI Chat Completions call per batch (no retry loop). Writes a merged JSON + optional
per-batch sidecars.

Usage:
  cd /path/to/nivo && set -a && [ -f .env ] && . ./.env && set +a
  PYTHONPATH=. python3 scripts/gpt_search_about_for_run_batch.py \\
    --run-id dd15199e-e342-4977-b639-9be1d72acb56 \\
    --filter gpt_url --batch-size 10 --target-min-nonempty-about 100
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

from pydantic import ValidationError

import gpt_search_about_for_run as gpt

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def nonempty_about(items: List[Dict[str, Any]]) -> int:
    return sum(1 for it in items if (it.get("about_text") or "").strip())


def _call_batch_with_retries(
    client: OpenAI,
    model: str,
    companies: List[Dict[str, str]],
    max_tok: int,
    api_retries: int,
) -> Tuple[str, Any]:
    last_err: Exception | None = None
    for attempt in range(max(1, api_retries)):
        try:
            return gpt.call_chat_search_about_batch(
                client, model, companies, max_completion_tokens=max_tok
            )
        except Exception as e:  # noqa: BLE001 — surface after retries
            last_err = e
            if attempt + 1 >= api_retries:
                raise
            delay = min(60.0, 2.0 ** attempt * 3.0)
            print(f"API error (attempt {attempt + 1}/{api_retries}): {e}; sleeping {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
    raise last_err  # pragma: no cover


def main() -> None:
    p = argparse.ArgumentParser(
        description="Batch GPT about search (gpt-4o-search-preview) until target nonempty count."
    )
    p.add_argument("--run-id", type=str, required=True)
    p.add_argument(
        "--filter",
        choices=("weak", "any_url", "gpt_url"),
        default="gpt_url",
        help="Default gpt_url = confirmed GPT official URL only",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Rows per API call (10 avoids large JSON truncation; 20+ may fail parse)",
    )
    p.add_argument(
        "--start-offset",
        type=int,
        default=0,
        help="SQL OFFSET into the filtered row set (e.g. 220 after a prior batch)",
    )
    p.add_argument(
        "--target-min-nonempty-about",
        type=int,
        default=100,
        help="Stop when this many items have non-empty about_text (cumulative)",
    )
    p.add_argument(
        "--max-batches",
        type=int,
        default=80,
        help="Safety cap on batch iterations (default 80)",
    )
    p.add_argument(
        "--sleep-seconds",
        type=float,
        default=1.0,
        help="Pause between API calls (rate limits)",
    )
    p.add_argument(
        "--api-retries",
        type=int,
        default=4,
        help="Retries per batch on OpenAI/API errors (exponential backoff)",
    )
    p.add_argument("--model", type=str, default=None)
    p.add_argument(
        "--max-completion-tokens",
        type=int,
        default=None,
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Merged JSON path",
    )
    p.add_argument(
        "--write-batch-files",
        action="store_true",
        help="Also write about_search_batch_NNN.json per batch next to merged output",
    )
    p.add_argument("--dry-run", action="store_true", help="Print plan and exit (no API)")
    args = p.parse_args()

    _load_dotenv()
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not args.dry_run and not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    run_id = args.run_id.strip()
    filter_mode = args.filter
    total_eligible = gpt.count_rows_for_filter(run_id, filter_mode)

    model = (args.model or os.getenv("GPT_CHAT_SEARCH_MODEL") or gpt.DEFAULT_MODEL).strip()
    max_tok = (
        args.max_completion_tokens
        if args.max_completion_tokens is not None
        else gpt._DEFAULT_MAX_COMPLETION_TOKENS
    )

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = args.out
    if out_path is None:
        out_path = (
            REPO_ROOT
            / "scripts"
            / "fixtures"
            / "gpt_website_retrieval_runs"
            / f"about_search_merged_{filter_mode}_{run_id[:8]}_{ts}.json"
        )
    out_path = out_path.resolve()
    batch_dir = out_path.parent

    plan = {
        "run_id": run_id,
        "filter": filter_mode,
        "total_eligible_rows": total_eligible,
        "start_offset": args.start_offset,
        "batch_size": args.batch_size,
        "target_min_nonempty_about": args.target_min_nonempty_about,
        "max_batches": args.max_batches,
        "model": model,
        "max_completion_tokens": max_tok,
        "output": str(out_path),
    }
    print(json.dumps(plan, indent=2, ensure_ascii=False))

    if args.dry_run:
        return

    if total_eligible == 0:
        raise SystemExit("No rows match filter; nothing to do.")

    client = OpenAI(api_key=api_key)
    merged_items: List[Dict[str, Any]] = []
    batches_meta: List[Dict[str, Any]] = []
    offset = max(0, args.start_offset)
    batch_idx = 0

    while batch_idx < args.max_batches:
        rows = gpt.fetch_rows(
            run_id,
            limit=args.batch_size,
            offset=offset,
            filter_mode=filter_mode,
        )
        if not rows:
            break

        companies = gpt.build_companies_payload(rows)
        row_ids = [r["id"] for r in rows]

        raw_text, resp = _call_batch_with_retries(
            client, model, companies, max_tok, args.api_retries
        )
        try:
            parsed = gpt.AboutBatchResult.model_validate(
                json.loads(gpt._strip_json_fence(raw_text))
            )
        except (json.JSONDecodeError, ValidationError) as e:
            err_path = batch_dir / f"about_search_batch_FAIL_{batch_idx:03d}_{ts}.json"
            write_json(
                err_path,
                {
                    "error": str(e),
                    "offset": offset,
                    "batch_index": batch_idx,
                    "row_ids": row_ids,
                    "input_companies": companies,
                    "raw_model_text": raw_text,
                    "response_meta": gpt._response_meta(resp),
                },
            )
            raise SystemExit(
                f"Parse failed at batch {batch_idx} offset {offset}; partial written to {err_path}"
            ) from e

        if len(parsed.items) != len(companies):
            raise SystemExit(
                f"Batch {batch_idx}: expected {len(companies)} items, got {len(parsed.items)}"
            )

        batch_items = [i.model_dump() for i in parsed.items]
        merged_items.extend(batch_items)

        meta = {
            "batch_index": batch_idx,
            "offset": offset,
            "row_ids": row_ids,
            "nonempty_in_batch": nonempty_about(batch_items),
            "cumulative_nonempty": nonempty_about(merged_items),
            "response_meta": gpt._response_meta(resp),
        }
        batches_meta.append(meta)

        if args.write_batch_files:
            write_json(
                batch_dir / f"about_search_batch_{batch_idx:03d}_{ts}.json",
                {
                    "batch_index": batch_idx,
                    "offset": offset,
                    "run_id": run_id,
                    "filter": filter_mode,
                    "items": batch_items,
                    "raw_model_text": raw_text,
                },
            )

        print(
            f"batch {batch_idx} offset {offset} rows {len(rows)} "
            f"nonempty_batch={meta['nonempty_in_batch']} cumulative_nonempty={meta['cumulative_nonempty']}"
        )

        if nonempty_about(merged_items) >= args.target_min_nonempty_about:
            offset += len(rows)
            batch_idx += 1
            write_json(
                out_path.with_suffix(out_path.suffix + ".checkpoint"),
                {
                    "next_offset": offset,
                    "merged_items": merged_items,
                    "batches_meta": batches_meta,
                },
            )
            break

        offset += len(rows)
        batch_idx += 1
        write_json(
            out_path.with_suffix(out_path.suffix + ".checkpoint"),
            {
                "next_offset": offset,
                "merged_items": merged_items,
                "batches_meta": batches_meta,
            },
        )

        if len(rows) < args.batch_size:
            break
        if args.sleep_seconds > 0:
            time.sleep(args.sleep_seconds)

    merged = {
        "schema_version": 1,
        "script": "gpt_search_about_for_run_batch.py",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "run_id": run_id,
        "filter": filter_mode,
        "start_offset": args.start_offset,
        "model": model,
        "max_completion_tokens": max_tok,
        "total_eligible_rows": total_eligible,
        "target_min_nonempty_about": args.target_min_nonempty_about,
        "achieved_nonempty_about": nonempty_about(merged_items),
        "total_items": len(merged_items),
        "note": (
            "Nonempty about_text depends on model+search; cohort size caps achievable rows "
            "(e.g. ~437 gpt_url rows — 100 nonempty may be impossible if hit rate stays low)."
        ),
        "batches": batches_meta,
        "items": merged_items,
    }
    write_json(out_path, merged)
    print(
        f"Wrote {out_path} — items={len(merged_items)} nonempty_about={merged['achieved_nonempty_about']}"
    )
    if (
        merged["achieved_nonempty_about"] < args.target_min_nonempty_about
        and args.target_min_nonempty_about < 50000
    ):
        print(
            "Note: target not reached (exhausted rows or hit max-batches). "
            "Increase max-batches or accept partial cohort.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
