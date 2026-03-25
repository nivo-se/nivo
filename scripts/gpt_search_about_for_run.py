#!/usr/bin/env python3
"""
Use OpenAI **Chat Completions** + search-preview model to find About / Om oss (or best company
description) given a known official site — complements HTTP fetch in
``fetch_website_about_for_run.py``.

Reads rows from ``screening_website_research_companies`` for a ``run_id``. **No HTTP scraper** in
this path: the model uses built-in web search once it has ``company_name`` + base URL.

**Easiest first test (10 companies):**

  cd /path/to/nivo && set -a && [ -f .env ] && . ./.env && set +a
  PYTHONPATH=. python3 scripts/gpt_search_about_for_run.py \\
    --run-id <uuid> --limit 10 --filter weak

  # Optional: ``--dry-run`` prints selected inputs (no API). ``--out path.json`` sets output file.
  # Page with ``--limit 20 --offset 0``, then ``--offset 20``, …

  # Ad-hoc batch (e.g. Playwright failures) — skip DB, use JSON with ``input_companies``:

  PYTHONPATH=. python3 scripts/gpt_search_about_for_run.py \\
    --run-id <uuid> --companies-json scripts/fixtures/.../batch.json

``--filter weak`` prefers rows where our fetch was thin or failed (``home_only``, ``http_error``,
``timeout``, ``empty_text``). ``--filter any_url`` = first rows with GPT or registry home URL.
``--filter gpt_url`` = **only** rows with non-empty ``gpt_official_website_url`` (confirmed GPT URL).

Output: JSON file with parsed items + raw assistant message (see ``--out``). **Does not** write
to Postgres (inspect results first). **No retries**: one API call per batch; on error, fix and re-run.

Requires: OPENAI_API_KEY, openai, pydantic, psycopg2-binary, python-dotenv (optional).

Model default: ``gpt-4o-search-preview`` (override ``--model`` or ``GPT_CHAT_SEARCH_MODEL``).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError as e:
    raise SystemExit("psycopg2-binary is required.") from e

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from screening_manifest_utils import git_commit_hash, utc_timestamp_iso, write_json

DEFAULT_MODEL = "gpt-4o-search-preview"
# Large batches need room for web-search + long about_text; default 16k (env override).
_DEFAULT_MAX_COMPLETION_TOKENS = int(os.getenv("GPT_ABOUT_SEARCH_MAX_COMPLETION_TOKENS", "16384"))

ABOUT_SYSTEM_PROMPT = """You are a research assistant extracting company “About” content for Swedish
B2B screening.

For each input company you receive:
- orgnr, company_name, official_website_url (canonical site the user already trusts).

Your job:
1. Use web search **starting from the official_website_url domain** to locate the best
   About / Om oss / Företaget / Company / Who we are style page (same site preferred).
2. Produce **faithful** plain text: prefer quoting or closely paraphrasing what appears on the site.
   Do not invent financials, customers, or certifications.
3. If no dedicated About page exists, use the **homepage** value proposition / short company description
   only if it clearly describes the legal entity — otherwise return empty about_text and explain in
   source_note.
4. Write about_text in the same language as the source (Swedish or English). Max ~2000 characters
   per company (truncate with "…" if needed).
5. about_source_url must be the page you used (https), or empty if you found nothing reliable.

Return **only** JSON matching the provided schema (one item per input company, same order and count).

Use normal UTF-8 text inside JSON strings (Swedish letters etc.); do **not** spell text as long ``\\uXXXX`` escape sequences.
"""


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _connect():
    _load_dotenv()
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=30)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=30,
    )


def _normalize_orgnr(raw: str) -> str:
    s = (raw or "").strip().replace(" ", "").replace("-", "")
    if len(s) == 10 and s.isdigit():
        return f"{s[:6]}-{s[6:]}"
    return (raw or "").strip()


class AboutItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    orgnr: str = Field(..., description="Swedish org number XXXXXX-XXXX as in input")
    company_name: str
    official_website_url: str = Field(..., description="Echo input base URL")
    about_text: str = Field(
        ...,
        description="Plain About/Om oss text or empty string if not found",
    )
    about_source_url: str = Field(
        ...,
        description="https URL of page used, or empty",
    )
    confidence_0_1: float = Field(..., ge=0.0, le=1.0)
    source_note: str = Field(..., max_length=600)


class AboutBatchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[AboutItem] = Field(..., min_length=1)


def about_batch_json_schema() -> dict[str, Any]:
    item_props = {
        "orgnr": {"type": "string"},
        "company_name": {"type": "string"},
        "official_website_url": {"type": "string"},
        "about_text": {"type": "string"},
        "about_source_url": {"type": "string"},
        "confidence_0_1": {"type": "number", "minimum": 0, "maximum": 1},
        "source_note": {"type": "string"},
    }
    req = list(item_props.keys())
    return {
        "name": "AboutExtractionBatch",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "properties": item_props,
                        "required": req,
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    }


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9]*\s*", "", t)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _user_message(companies: List[Dict[str, Any]], expect_count: int) -> str:
    payload = json.dumps(companies, ensure_ascii=False, separators=(",", ":"))
    return (
        f"Extract About/Om oss for exactly {expect_count} companies. Input JSON array (order fixed):\n"
        f"{payload}\n"
        "Each object has orgnr, company_name, official_website_url. "
        "Respond with JSON object {\"items\": [...]} with the same count and order."
    )


def fetch_rows(
    run_id: str,
    *,
    limit: int,
    offset: int,
    filter_mode: str,
) -> List[Dict[str, Any]]:
    weak_statuses = ("home_only", "http_error", "timeout", "empty_text", "non_html")
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            base_sql = """
                SELECT id, orgnr, company_name, gpt_official_website_url,
                       about_fetch_final_home_url, about_fetch_status
                FROM public.screening_website_research_companies
                WHERE run_id = %s::uuid
            """
            params: List[Any] = [run_id]
            if filter_mode == "weak":
                base_sql += f" AND about_fetch_status IN {weak_statuses}"
            if filter_mode == "gpt_url":
                base_sql += """
                    AND gpt_official_website_url IS NOT NULL
                    AND btrim(gpt_official_website_url) <> ''
                """
            else:
                base_sql += """
                    AND (
                        (gpt_official_website_url IS NOT NULL AND btrim(gpt_official_website_url) <> '')
                        OR (about_fetch_final_home_url IS NOT NULL AND btrim(about_fetch_final_home_url) <> '')
                    )
                """
            base_sql += " ORDER BY rank NULLS LAST, orgnr LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            cur.execute(base_sql, tuple(params))
            return list(cur.fetchall())
    finally:
        conn.close()


def count_rows_for_filter(run_id: str, filter_mode: str) -> int:
    """Row count matching ``fetch_rows`` (same filter, no limit/offset)."""
    weak_statuses = ("home_only", "http_error", "timeout", "empty_text", "non_html")
    conn = _connect()
    try:
        with conn.cursor() as cur:
            sql = (
                "SELECT COUNT(*) FROM public.screening_website_research_companies "
                "WHERE run_id = %s::uuid"
            )
            params: List[Any] = [run_id]
            if filter_mode == "weak":
                sql += f" AND about_fetch_status IN {weak_statuses}"
            if filter_mode == "gpt_url":
                sql += (
                    " AND gpt_official_website_url IS NOT NULL "
                    "AND btrim(gpt_official_website_url) <> ''"
                )
            else:
                sql += """
                    AND (
                        (gpt_official_website_url IS NOT NULL AND btrim(gpt_official_website_url) <> '')
                        OR (about_fetch_final_home_url IS NOT NULL AND btrim(about_fetch_final_home_url) <> '')
                    )
                """
            cur.execute(sql, tuple(params))
            r = cur.fetchone()
            return int(r[0]) if r else 0
    finally:
        conn.close()


def _base_url(row: Dict[str, Any]) -> str:
    g = (row.get("gpt_official_website_url") or "").strip()
    h = (row.get("about_fetch_final_home_url") or "").strip()
    return g or h


def build_companies_payload(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for r in rows:
        org = _normalize_orgnr(str(r.get("orgnr") or ""))
        name = str(r.get("company_name") or "").strip()
        url = _base_url(r)
        out.append(
            {
                "orgnr": org,
                "company_name": name,
                "official_website_url": url,
            }
        )
    return out


def companies_from_json_file(path: Path) -> List[Dict[str, str]]:
    """Load ``input_companies`` from JSON (orgnr, company_name, official_website_url)."""
    data = json.loads(path.read_text(encoding="utf-8"))
    raw = data.get("input_companies") or data.get("companies")
    if not raw or not isinstance(raw, list):
        raise ValueError("JSON must contain input_companies (or companies) array")
    out: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        org = _normalize_orgnr(str(item.get("orgnr") or ""))
        name = str(item.get("company_name") or "").strip()
        url = str(item.get("official_website_url") or item.get("url") or "").strip()
        if not url:
            raise ValueError(f"Missing official_website_url for orgnr={org}")
        out.append({"orgnr": org, "company_name": name, "official_website_url": url})
    if not out:
        raise ValueError("No companies in JSON")
    return out


def _response_meta(resp: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": getattr(resp, "id", None),
        "model": getattr(resp, "model", None),
    }
    choices = getattr(resp, "choices", None) or []
    if choices:
        out["finish_reason"] = getattr(choices[0], "finish_reason", None)
    usage = getattr(resp, "usage", None)
    if usage is not None and hasattr(usage, "model_dump"):
        out["usage"] = usage.model_dump()
    elif usage is not None:
        out["usage"] = str(usage)
    return out


def call_chat_search_about_batch(
    client: OpenAI,
    model: str,
    companies: List[Dict[str, str]],
    *,
    max_completion_tokens: int,
) -> Tuple[str, Any]:
    expect = len(companies)
    if expect < 1:
        raise ValueError("empty companies")
    block = about_batch_json_schema()
    user_text = _user_message(companies, expect)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": ABOUT_SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        max_completion_tokens=max_completion_tokens,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": block["name"],
                "strict": block["strict"],
                "schema": block["schema"],
            },
        },
    )
    msg = resp.choices[0].message
    raw = (msg.content or "").strip()
    return raw, resp


def main() -> None:
    p = argparse.ArgumentParser(description="GPT web search: extract About text for website-research run rows.")
    p.add_argument(
        "--run-id",
        type=str,
        required=True,
        help="screening_runs.id (for manifest); use cohort UUID even with --companies-json",
    )
    p.add_argument("--limit", type=int, default=10, help="Max rows in this batch (default 10)")
    p.add_argument("--offset", type=int, default=0, help="SQL OFFSET for paging later")
    p.add_argument(
        "--filter",
        choices=("weak", "any_url", "gpt_url"),
        default="weak",
        help="weak | any_url (GPT or registry home) | gpt_url (non-empty gpt_official_website_url only)",
    )
    p.add_argument(
        "--model",
        type=str,
        default=None,
        help="Default: GPT_CHAT_SEARCH_MODEL or gpt-4o-search-preview",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output JSON path (default: scripts/fixtures/gpt_website_retrieval_runs/about_search_<ts>.json)",
    )
    p.add_argument("--dry-run", action="store_true", help="Print payload only; no API call")
    p.add_argument(
        "--max-completion-tokens",
        type=int,
        default=None,
        help=f"Chat Completions max_completion_tokens (default: env GPT_ABOUT_SEARCH_MAX_COMPLETION_TOKENS or {_DEFAULT_MAX_COMPLETION_TOKENS})",
    )
    p.add_argument(
        "--companies-json",
        type=Path,
        default=None,
        help="Skip DB: JSON file with input_companies [{orgnr, company_name, official_website_url}, ...]",
    )
    args = p.parse_args()

    _load_dotenv()
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not args.dry_run and not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    model = (args.model or os.getenv("GPT_CHAT_SEARCH_MODEL") or DEFAULT_MODEL).strip()
    run_id = args.run_id.strip()

    filter_mode = args.filter
    row_ids: List[Any] = []
    if args.companies_json:
        cj = args.companies_json.resolve()
        if not cj.is_file():
            raise SystemExit(f"Not found: {cj}")
        companies = companies_from_json_file(cj)
        filter_mode = f"companies_json:{cj.name}"
    else:
        rows = fetch_rows(run_id, limit=args.limit, offset=args.offset, filter_mode=filter_mode)
        if not rows:
            raise SystemExit(
                f"No rows for run_id={run_id} filter={filter_mode} limit={args.limit} offset={args.offset}. "
                "Try --filter any_url or check run_id."
            )
        row_ids = [r["id"] for r in rows]
        companies = build_companies_payload(rows)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = args.out
    if out_path is None:
        out_path = (
            REPO_ROOT
            / "scripts"
            / "fixtures"
            / "gpt_website_retrieval_runs"
            / f"about_search_{ts}.json"
        )
    out_path = out_path.resolve()

    max_completion_tokens = (
        args.max_completion_tokens
        if args.max_completion_tokens is not None
        else _DEFAULT_MAX_COMPLETION_TOKENS
    )

    manifest = {
        "schema_version": 1,
        "script": "gpt_search_about_for_run.py",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "run_id": run_id,
        "model": model,
        "filter": filter_mode,
        "limit": len(companies) if args.companies_json else args.limit,
        "offset": 0 if args.companies_json else args.offset,
        "max_completion_tokens": max_completion_tokens,
        "companies_json": str(args.companies_json.resolve()) if args.companies_json else None,
        "row_ids": row_ids,
        "input_companies": companies,
    }

    if args.dry_run:
        print(json.dumps(manifest, indent=2, ensure_ascii=False))
        return

    client = OpenAI(api_key=api_key)
    raw_text, resp = call_chat_search_about_batch(
        client, model, companies, max_completion_tokens=max_completion_tokens
    )
    try:
        parsed = AboutBatchResult.model_validate(json.loads(_strip_json_fence(raw_text)))
    except (json.JSONDecodeError, ValidationError) as e:
        write_json(
            out_path,
            {
                **manifest,
                "parse_error": str(e),
                "raw_model_text": raw_text,
                "response_meta": _response_meta(resp),
            },
        )
        raise SystemExit(f"Parse failed; partial output written to {out_path}: {e}") from e

    if len(parsed.items) != len(companies):
        raise SystemExit(
            f"Expected {len(companies)} items, got {len(parsed.items)} (no retries; fix prompt or re-run smaller batch)"
        )

    out_payload = {
        **manifest,
        "items": [i.model_dump() for i in parsed.items],
        "raw_model_text": raw_text,
        "response_meta": _response_meta(resp),
    }
    write_json(out_path, out_payload)
    print(f"Wrote {out_path} ({len(parsed.items)} items)")


if __name__ == "__main__":
    main()
