#!/usr/bin/env python3
"""
Layer 2–style Nivo fit classification using **GPT-about JSON** as evidence (no Tavily / HTTP fetch).

Reads ``items[]`` from e.g. ``about_search_*_complete_clean.json``, batches OpenAI Chat Completions
with the same ``Layer2Classification`` schema as ``screening_layer2_run.py``, writes JSONL + CSV
sorted by fit. Optionally merges Stage 1 ``total_score`` from ``pool_snapshot_json`` via
``--run-id`` + ``--fetch-stage1-from-db`` and computes ``blended_score``.

Usage:
  cd /path/to/nivo && set -a && [ -f .env ] && . ./.env && set +a
  PYTHONPATH=. python3 scripts/screening_layer2_from_gpt_about_json.py \\
    --input scripts/fixtures/gpt_website_retrieval_runs/about_search_merged_gpt_url_dd15199e_complete_clean.json \\
    --out-dir scripts/fixtures/gpt_website_retrieval_runs/layer2_from_gpt_about_dd15199e \\
    --run-id dd15199e-e342-4977-b639-9be1d72acb56 --fetch-stage1-from-db

  PYTHONPATH=. python3 scripts/screening_layer2_from_gpt_about_json.py ... --dry-run --limit 3
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.services.screening_layer2.blend import blend_score
from backend.services.screening_layer2.models import Layer2Classification, openai_json_schema_strict
from backend.services.screening_layer2.prompts import SYSTEM_PROMPT

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json

SCRIPT_VERSION = "1.0.0"

GPT_ABOUT_SYSTEM_APPEND = """

Evidence source for this batch: **GPT web-search about excerpts** (not live page fetch). Each block is
labeled ``GPT_ABOUT`` with a cited ``about_source_url``. Treat this as **secondary web-derived text**:
be conservative; do not invent facts beyond the excerpt. If the excerpt is thin or generic, set
``fit_confidence`` low and prefer ``unknown`` enums. Do **not** assume identity is wrong solely because
the pipeline differs from Tavily — but discount strong fit if the text does not clearly describe this
legal entity (orgnr / company_name). Cite short phrases from the excerpt in ``evidence`` bullets.
"""

DEFAULT_MODEL = os.getenv("SCREENING_LAYER2_MODEL", "gpt-4o-mini")
_DEFAULT_MAX_COMPLETION = int(os.getenv("GPT_LAYER2_FROM_ABOUT_MAX_COMPLETION", "16384"))


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _norm_org_key(org: str) -> str:
    return (org or "").strip().replace(" ", "").replace("-", "")


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9]*\s*", "", t)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _as_pool_dict(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return dict(json.loads(raw))
        except Exception:
            return {}
    return {}


def load_stage1_from_db(run_id: str) -> Dict[str, float]:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError as e:
        raise RuntimeError("psycopg2-binary required for --fetch-stage1-from-db") from e

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        conn = psycopg2.connect(url, connect_timeout=30)
    else:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5433")),
            dbname=os.getenv("POSTGRES_DB", "nivo"),
            user=os.getenv("POSTGRES_USER", "nivo"),
            password=os.getenv("POSTGRES_PASSWORD", "nivo"),
            connect_timeout=30,
        )
    out: Dict[str, float] = {}
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT orgnr, pool_snapshot_json
                FROM public.screening_website_research_companies
                WHERE run_id = %s::uuid
                """,
                (run_id,),
            )
            for row in cur.fetchall():
                org = str(row.get("orgnr") or "").strip()
                pool = _as_pool_dict(row.get("pool_snapshot_json"))
                raw_score = pool.get("total_score")
                if raw_score is None:
                    raw_score = pool.get("base_similarity_score")
                try:
                    s = float(raw_score) if raw_score is not None else 0.0
                except (TypeError, ValueError):
                    s = 0.0
                out[_norm_org_key(org)] = s
    finally:
        conn.close()
    return out


def evidence_from_gpt_about_item(item: Dict[str, Any]) -> str:
    src = (item.get("about_source_url") or "").strip()
    note = (item.get("source_note") or "").strip()
    body = (item.get("about_text") or "").strip()
    lines = [f"GPT_ABOUT (source: {src or 'unknown'}):"]
    if body:
        lines.append(body)
    if note:
        lines.append(f"SOURCE_NOTE: {note}")
    return "\n".join(lines)


def layer2_batch_response_schema() -> Dict[str, Any]:
    item = openai_json_schema_strict()
    return {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "minItems": 1,
                "items": item,
            }
        },
        "required": ["items"],
        "additionalProperties": False,
    }


class Layer2BatchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[Layer2Classification] = Field(..., min_length=1)


def build_batch_user_prompt(
    rows: List[Dict[str, Any]],
    stage1_map: Dict[str, float],
) -> str:
    parts: List[str] = []
    parts.append(
        f"Classify exactly {len(rows)} companies. Output JSON object {{\"items\": [...]}} with "
        f"the same count and order as below. Each item must match the Layer2Classification schema.\n"
    )
    for i, row in enumerate(rows, start=1):
        org = str(row.get("orgnr") or "").strip()
        name = str(row.get("company_name") or "").strip()
        s1 = stage1_map.get(_norm_org_key(org), 0.0)
        ev = evidence_from_gpt_about_item(row)
        parts.append(f"--- Company {i} / {len(rows)} ---")
        parts.append(f"orgnr: {org}")
        parts.append(f"company_name: {name}")
        parts.append(f"stage1_total_score (deterministic similarity 0-100, or 0 if unknown): {s1:.2f}")
        parts.append("Website evidence (GPT-about excerpt):")
        parts.append(ev)
        parts.append("")
    parts.append(
        "Retrieval note: single-source GPT web-search about text; not a live multi-page crawl. "
        "Be conservative if the excerpt is vague."
    )
    return "\n".join(parts)


def call_openai_batch(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_content: str,
    *,
    temperature: float,
    max_completion_tokens: int,
) -> Tuple[str, Any]:
    block = layer2_batch_response_schema()
    resp = client.chat.completions.create(
        model=model,
        temperature=temperature,
        max_completion_tokens=max_completion_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "Layer2ClassificationBatch",
                "strict": True,
                "schema": block,
            },
        },
    )
    raw = resp.choices[0].message.content or "{}"
    if isinstance(raw, list):
        raw = "".join(p.get("text", "") for p in raw if isinstance(p, dict))
    return str(raw).strip(), resp


def _call_with_retries(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_content: str,
    *,
    temperature: float,
    max_completion_tokens: int,
    api_retries: int,
) -> Tuple[str, Any]:
    last: Exception | None = None
    for attempt in range(max(1, api_retries)):
        try:
            return call_openai_batch(
                client,
                model,
                system_prompt,
                user_content,
                temperature=temperature,
                max_completion_tokens=max_completion_tokens,
            )
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt + 1 >= api_retries:
                raise
            delay = min(60.0, 2.0**attempt * 3.0)
            print(f"API error (attempt {attempt + 1}/{api_retries}): {e}; sleep {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
    raise last  # pragma: no cover


def main() -> None:
    ap = argparse.ArgumentParser(description="Layer 2 classify from GPT-about clean JSON (batched).")
    ap.add_argument("--input", type=Path, required=True, help="Clean JSON with items[]")
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=8, help="Companies per API call (default 8)")
    ap.add_argument("--model", type=str, default=DEFAULT_MODEL)
    ap.add_argument("--temperature", type=float, default=0.2)
    ap.add_argument("--sleep-seconds", type=float, default=0.5)
    ap.add_argument("--w-stage1", type=float, default=0.4)
    ap.add_argument("--w-layer2", type=float, default=0.6)
    ap.add_argument(
        "--run-id",
        type=str,
        default=None,
        help="With --fetch-stage1-from-db: website research run UUID",
    )
    ap.add_argument(
        "--fetch-stage1-from-db",
        action="store_true",
        help="Load total_score from pool_snapshot_json for --run-id",
    )
    ap.add_argument(
        "--criteria-append",
        type=Path,
        default=None,
        help="Optional markdown file appended to system prompt (team-specific interests)",
    )
    ap.add_argument(
        "--max-completion-tokens",
        type=int,
        default=None,
    )
    ap.add_argument("--api-retries", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    _load_dotenv()
    inp = args.input.resolve()
    data = json.loads(inp.read_text(encoding="utf-8"))
    items: List[Dict[str, Any]] = list(data.get("items") or [])
    if args.limit is not None:
        items = items[: max(0, args.limit)]

    if not items:
        raise SystemExit("No items in input JSON.")

    stage1_map: Dict[str, float] = {}
    if args.fetch_stage1_from_db:
        if not args.run_id or not str(args.run_id).strip():
            raise SystemExit("--fetch-stage1-from-db requires --run-id")
        stage1_map = load_stage1_from_db(str(args.run_id).strip())
        print(f"Loaded stage1 scores for {len(stage1_map)} orgnrs from DB", file=sys.stderr)

    system_prompt = SYSTEM_PROMPT + GPT_ABOUT_SYSTEM_APPEND
    if args.criteria_append and args.criteria_append.is_file():
        system_prompt += "\n\nAdditional criteria (team):\n" + args.criteria_append.read_text(encoding="utf-8")

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    jsonl_path = out_dir / f"layer2_from_gpt_about_{ts}.jsonl"
    csv_path = out_dir / f"layer2_from_gpt_about_{ts}.csv"
    manifest_path = out_dir / f"layer2_from_gpt_about_{ts}_manifest.json"

    max_tok = args.max_completion_tokens if args.max_completion_tokens is not None else _DEFAULT_MAX_COMPLETION

    manifest = {
        "run_kind": "layer2_from_gpt_about_json",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "script": "screening_layer2_from_gpt_about_json.py",
        "script_version": SCRIPT_VERSION,
        "input": str(inp),
        "out_dir": str(out_dir),
        "model": args.model,
        "temperature": args.temperature,
        "batch_size": args.batch_size,
        "items_count": len(items),
        "fetch_stage1_from_db": bool(args.fetch_stage1_from_db),
        "run_id": args.run_id,
        "blend": {"w_stage1": args.w_stage1, "w_layer2": args.w_layer2},
        "max_completion_tokens": max_tok,
    }
    write_json(manifest_path, manifest)

    if args.dry_run:
        sample = items
        print(build_batch_user_prompt(sample, stage1_map))
        print(f"\n[dry-run] Would write {jsonl_path}, {csv_path}")
        return

    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)
    rows_out: List[Dict[str, Any]] = []
    batch_size = max(1, args.batch_size)

    for start in range(0, len(items), batch_size):
        chunk = items[start : start + batch_size]
        user_text = build_batch_user_prompt(chunk, stage1_map)
        raw_text, _resp = _call_with_retries(
            client,
            args.model,
            system_prompt,
            user_text,
            temperature=args.temperature,
            max_completion_tokens=max_tok,
            api_retries=args.api_retries,
        )
        try:
            parsed = Layer2BatchResult.model_validate(json.loads(_strip_json_fence(raw_text)))
        except (json.JSONDecodeError, ValidationError) as e:
            err_path = out_dir / f"layer2_from_gpt_about_FAIL_{start}_{ts}.json"
            write_json(
                err_path,
                {
                    "error": str(e),
                    "start_index": start,
                    "raw": raw_text[:8000],
                    "input_slice": chunk,
                },
            )
            raise SystemExit(f"Parse failed at batch start={start}; wrote {err_path}") from e

        if len(parsed.items) != len(chunk):
            raise SystemExit(
                f"Batch start={start}: expected {len(chunk)} items, got {len(parsed.items)}"
            )

        for raw_row, obj in zip(chunk, parsed.items, strict=True):
            org_raw = str(raw_row.get("orgnr") or "").strip()
            if _norm_org_key(obj.orgnr) != _norm_org_key(org_raw):
                print(
                    f"Warning: orgnr mismatch input={org_raw} model={obj.orgnr} (order or model drift)",
                    file=sys.stderr,
                )
            s1 = stage1_map.get(_norm_org_key(org_raw), 0.0)
            b = blend_score(s1, obj.is_fit_for_nivo, obj.fit_confidence, args.w_stage1, args.w_layer2)
            flat = obj.model_dump()
            flat["stage1_total_score"] = round(s1, 4)
            flat["blended_score"] = round(b, 4)
            flat["official_website_url"] = (raw_row.get("official_website_url") or "").strip()
            flat["gpt_about_source_url"] = (raw_row.get("about_source_url") or "").strip()
            flat["gpt_about_confidence"] = raw_row.get("confidence_0_1")
            rows_out.append(flat)

        print(f"batch start={start} size={len(chunk)} ok", file=sys.stderr)
        if args.sleep_seconds > 0 and start + batch_size < len(items):
            time.sleep(args.sleep_seconds)

    rows_out.sort(
        key=lambda r: (bool(r.get("is_fit_for_nivo")), float(r.get("fit_confidence") or 0.0)),
        reverse=True,
    )
    for i, r in enumerate(rows_out, start=1):
        r["fit_rank"] = i

    with jsonl_path.open("w", encoding="utf-8") as jf:
        for r in rows_out:
            jf.write(json.dumps(r, ensure_ascii=False) + "\n")

    preferred = [
        "fit_rank",
        "orgnr",
        "company_name",
        "official_website_url",
        "gpt_about_source_url",
        "is_fit_for_nivo",
        "fit_confidence",
        "stage1_total_score",
        "blended_score",
        "business_type",
        "operating_model",
        "reason_summary",
        "niche_indicator",
        "differentiation_indicator",
        "repeat_purchase_indicator",
        "scalable_business_indicator",
        "red_flags",
        "evidence",
    ]
    pref_set = set(preferred)
    extras = sorted({k for r in rows_out for k in r.keys() if k not in pref_set})
    fieldnames = [k for k in preferred if k in rows_out[0]] + extras

    with csv_path.open("w", newline="", encoding="utf-8") as cf:
        w = csv.DictWriter(cf, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows_out:
            row = {k: r.get(k) for k in fieldnames}
            for k, v in list(row.items()):
                if isinstance(v, list):
                    row[k] = "|".join(str(x) for x in v)
            w.writerow(row)

    manifest["artifacts"] = {
        "jsonl": str(jsonl_path),
        "csv": str(csv_path),
    }
    write_json(manifest_path, manifest)
    print(f"Wrote {jsonl_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
