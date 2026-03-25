#!/usr/bin/env python3
"""
GPT-only batch official-website retrieval (no Tavily).

Production pattern: chunk inputs into groups of ~20 companies; one OpenAI Responses
call per chunk with web_search; strict JSON schema output; measure quality without
retries on the first pass.

Structured output uses the Responses API ``text.format`` JSON schema (not the legacy
``response_format`` parameter). If the API rejects ``web_search`` + structured ``text``
together, this script falls back to a single web_search-only call and parses/validates
JSON from ``output_text`` (still one logical attempt per chunk, no retry loop).

Usage:
  # Refresh pool from DB (optional; default input is scripts/fixtures/gpt_website_retrieval_shortlist_pool.csv):
  PYTHONPATH=. python3 scripts/export_gpt_website_retrieval_pool_csv.py

  cd /path/to/nivo && PYTHONPATH=. python3 scripts/gpt_batch_website_retrieval_test.py \\
    --top-pool 300 --sample 20 --seed 42

  # Or pass another ranked CSV (same columns as screening_rank_v1 --out):
  PYTHONPATH=. python3 scripts/gpt_batch_website_retrieval_test.py --input /path/to/rank.csv

Requires: OPENAI_API_KEY, pydantic, openai, httpx. CSV is read with the stdlib (no pandas required).

Default model is ``gpt-4o-search-preview`` (web_search + structured outputs). Override with
``--model`` or ``GPT_WEBSITE_RETRIEVAL_MODEL`` (e.g. ``gpt-4o`` if the preview id 404s on your account).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from screening_manifest_utils import git_commit_hash, sha256_file, utc_timestamp_iso, write_json

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

import httpx
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError

logger = logging.getLogger(__name__)

# Search-preview models are tuned for web_search; fall back to gpt-4o via env/CLI if unavailable.
DEFAULT_MODEL = "gpt-4o-search-preview"
DEFAULT_TOP_POOL = 300
DEFAULT_SAMPLE = 20
FIXTURE_RUNS_PARENT = REPO_ROOT / "scripts" / "fixtures" / "gpt_website_retrieval_runs"
DEFAULT_INPUT_POOL = REPO_ROOT / "scripts" / "fixtures" / "gpt_website_retrieval_shortlist_pool.csv"


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def _fix_orgnr_format(s: str) -> str:
    s = (s or "").strip().replace(" ", "").replace("-", "")
    if len(s) == 10 and s.isdigit():
        return f"{s[:6]}-{s[6:]}"
    return (s or "").strip()


class WebsiteGuess(BaseModel):
    model_config = ConfigDict(extra="forbid")

    orgnr: str = Field(..., description="Swedish org number as in input, preferably XXXXXX-XXXX")
    company_name: str
    official_website_url: str = Field(
        ...,
        description="Canonical https URL for the company's official site, or empty string if unknown",
    )
    confidence_0_1: float = Field(..., ge=0.0, le=1.0)
    source_note: str = Field(..., max_length=500)


class WebsiteRetrievalBatchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[WebsiteGuess] = Field(..., min_length=1)


def openai_website_batch_json_schema() -> dict[str, Any]:
    """Schema bundle: name, strict, schema (for Responses ``text.format``)."""
    item_props = {
        "orgnr": {"type": "string"},
        "company_name": {"type": "string"},
        "official_website_url": {"type": "string"},
        "confidence_0_1": {"type": "number", "minimum": 0, "maximum": 1},
        "source_note": {"type": "string"},
    }
    item_required = list(item_props.keys())
    return {
        "name": "WebsiteRetrievalBatch",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": item_props,
                        "required": item_required,
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    }


def _responses_text_json_schema_kwarg() -> Dict[str, Any]:
    """Keyword argument ``text=`` for ``client.responses.create`` structured outputs."""
    block = openai_website_batch_json_schema()
    return {
        "text": {
            "format": {
                "type": "json_schema",
                "name": block["name"],
                "strict": block["strict"],
                "schema": block["schema"],
            }
        }
    }


def _sort_pool_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if not rows:
        return rows
    keys = {k.lower(): k for k in rows[0].keys()}
    col_rank = keys.get("rank")
    col_score = keys.get("total_score")
    if col_rank:

        def rank_key(r: Dict[str, str]) -> Tuple[int, str]:
            v = (r.get(col_rank) or "").strip()
            try:
                return (int(float(v)), "")
            except ValueError:
                return (10**9, v)

        return sorted(rows, key=rank_key)
    if col_score:

        def score_key(r: Dict[str, str]) -> Tuple[float, str]:
            v = (r.get(col_score) or "").strip()
            try:
                return (-float(v), "")
            except ValueError:
                return (0.0, v)

        return sorted(rows, key=score_key)
    return rows


def _read_csv_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise SystemExit("CSV has no header row")
        norm = {h.strip().lower(): h for h in reader.fieldnames if h}
        if "orgnr" not in norm or "company_name" not in norm:
            raise SystemExit("CSV must contain columns: orgnr, company_name")
        rows: List[Dict[str, str]] = []
        for raw in reader:
            row = {k: (raw.get(k) or "").strip() for k in reader.fieldnames if k}
            rows.append(row)
    return rows


def load_and_sample(
    path: Path,
    top_pool: int,
    sample_n: int,
    seed: int,
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    rows = _read_csv_rows(path)
    rows = _sort_pool_rows(rows)
    pool = rows[: int(top_pool)]
    if not pool:
        raise SystemExit("Top pool is empty after load/sort.")
    n = min(int(sample_n), len(pool))
    if n < 1:
        raise SystemExit("--sample must be >= 1")
    rng = random.Random(seed)
    idx = rng.sample(range(len(pool)), n)
    sampled = [pool[i] for i in sorted(idx)]
    return pool, sampled


def build_request_payload(sampled: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for row in sampled:
        name = (row.get("company_name") or "").strip()
        org_raw = (row.get("orgnr") or "").strip()
        out.append({"name": name, "orgnr": _fix_orgnr_format(org_raw)})
    return out


SYSTEM_PROMPT = """You are a research assistant. For each Swedish company given (legal name + orgnr), \
use web search to find the company's official public website (primary corporate site, not Allabolag, \
Proff, LinkedIn, or news only). Match each output row to the same orgnr and company_name as input. \
If you cannot find a confident official URL, set official_website_url to an empty string and lower confidence."""


def _user_prompt(companies_json: str, expect_count: int) -> str:
    return f"""Companies (JSON array, each object has \"name\" and \"orgnr\"):
{companies_json}

Return a JSON object with key \"items\": an array of exactly {expect_count} objects, one per company above, \
same order as given. Each object must include: orgnr, company_name, official_website_url (https URL or empty string), \
confidence_0_1 (0-1), source_note (brief, what you verified)."""


def _fallback_user_prompt(companies_json: str, expect_count: int) -> str:
    schema_hint = json.dumps(openai_website_batch_json_schema()["schema"], indent=2)
    return (
        _user_prompt(companies_json, expect_count)
        + "\n\nRespond with ONLY valid JSON matching this schema (no markdown fences):\n"
        + schema_hint
    )


def _response_output_text(response: Any) -> str:
    raw = getattr(response, "output_text", None)
    if raw:
        return raw.strip()
    out = getattr(response, "output", None) or []
    for item in out:
        if getattr(item, "type", None) != "message":
            continue
        for block in getattr(item, "content", None) or []:
            if getattr(block, "type", None) == "output_text":
                t = getattr(block, "text", None)
                if t:
                    return str(t).strip()
    return ""


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _serialize_response_for_debug(response: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key in ("id", "model", "status", "error"):
        if hasattr(response, key):
            v = getattr(response, key)
            if v is not None:
                try:
                    json.dumps(v)
                    out[key] = v
                except TypeError:
                    out[key] = str(v)
    usage = getattr(response, "usage", None)
    if usage is not None:
        if hasattr(usage, "model_dump"):
            out["usage"] = usage.model_dump()
        elif isinstance(usage, dict):
            out["usage"] = usage
        else:
            out["usage"] = str(usage)
    out["output_text"] = _response_output_text(response)
    return out


class OpenAIBatchCallError(Exception):
    """Raised when both structured and fallback Responses calls fail."""

    def __init__(self, message: str, *, structured_rejection: Optional[str] = None) -> None:
        super().__init__(message)
        self.structured_rejection = structured_rejection


def _call_openai_batch(
    client: OpenAI,
    model: str,
    companies: List[Dict[str, str]],
) -> Tuple[Any, str, Optional[str]]:
    """
    Returns (response, mode_used, structured_format_rejection).
    mode_used: \"structured\" if response_format applied, else \"fallback_parse\".
    structured_format_rejection is set when fallback was used after the first call rejected.
    """
    companies_json = json.dumps(companies, ensure_ascii=False, indent=2)
    expect_count = len(companies)
    user_text = _user_prompt(companies_json, expect_count)
    input_messages = [
        {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
        {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
    ]
    kwargs: Dict[str, Any] = {
        "model": model,
        "input": input_messages,
        "tools": [{"type": "web_search"}],
        "tool_choice": "required",
    }
    structured_error: Optional[str] = None
    try:
        kwargs_fmt = {**kwargs, **_responses_text_json_schema_kwarg()}
        resp = client.responses.create(**kwargs_fmt)
        return resp, "structured", None
    except Exception as e:  # noqa: BLE001 — surface any API/SDK rejection
        structured_error = f"{type(e).__name__}: {e}"
        logger.warning("Structured text.format + web_search failed (%s); using fallback parse.", structured_error)

    user_fb = _fallback_user_prompt(companies_json, expect_count)
    input_fb = [
        {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
        {"role": "user", "content": [{"type": "input_text", "text": user_fb}]},
    ]
    try:
        resp = client.responses.create(
            model=model,
            input=input_fb,
            tools=[{"type": "web_search"}],
            tool_choice="required",
        )
    except Exception as e2:  # noqa: BLE001
        raise OpenAIBatchCallError(
            f"{type(e2).__name__}: {e2}",
            structured_rejection=structured_error,
        ) from e2
    return resp, "fallback_parse", structured_error


def parse_batch_from_response_text(text: str) -> WebsiteRetrievalBatchResult:
    cleaned = _strip_json_fence(text)
    data = json.loads(cleaned)
    return WebsiteRetrievalBatchResult.model_validate(data)


def head_verify_urls(items: List[WebsiteGuess], timeout: float = 5.0) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    headers = {"User-Agent": "NivoGptWebsiteRetrievalTest/1.0 (+https://nivogroup.se)"}
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
        for it in items:
            url = (it.official_website_url or "").strip()
            if not url:
                results.append(
                    {
                        "orgnr": it.orgnr,
                        "url": "",
                        "ok": None,
                        "status_code": None,
                        "error": "empty_url",
                    }
                )
                continue
            try:
                r = client.head(url)
                ok = r.status_code < 400
                results.append(
                    {
                        "orgnr": it.orgnr,
                        "url": url,
                        "ok": ok,
                        "status_code": r.status_code,
                        "error": None if ok else f"status_{r.status_code}",
                    }
                )
            except Exception as e:  # noqa: BLE001
                results.append(
                    {
                        "orgnr": it.orgnr,
                        "url": url,
                        "ok": False,
                        "status_code": None,
                        "error": f"{type(e).__name__}: {e}",
                    }
                )
    return results


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="GPT batch website retrieval test (no Tavily).")
    parser.add_argument(
        "--input",
        type=Path,
        nargs="?",
        default=None,
        help=(
            "Ranked CSV with orgnr, company_name, rank/total_score (default: "
            "scripts/fixtures/gpt_website_retrieval_shortlist_pool.csv; generate with "
            "scripts/export_gpt_website_retrieval_pool_csv.py)"
        ),
    )
    parser.add_argument("--top-pool", type=int, default=DEFAULT_TOP_POOL, help="Rows to take from top of list")
    parser.add_argument("--sample", type=int, default=DEFAULT_SAMPLE, help="Random sample size (chunk size)")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducible sample")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: scripts/fixtures/gpt_website_retrieval_runs/<timestamp>/)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="OpenAI model (default: env GPT_WEBSITE_RETRIEVAL_MODEL or gpt-4o-search-preview)",
    )
    parser.add_argument(
        "--head-verify",
        action="store_true",
        help="After parse, HEAD each official_website_url (short timeout per URL)",
    )
    args = parser.parse_args()
    _load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not str(api_key).strip():
        raise SystemExit("OPENAI_API_KEY is not set")

    model = (args.model or os.getenv("GPT_WEBSITE_RETRIEVAL_MODEL") or DEFAULT_MODEL).strip()

    inp = (args.input or DEFAULT_INPUT_POOL).resolve()
    if not inp.is_file():
        raise SystemExit(
            f"Input CSV not found: {inp}\n"
            "Generate it with: PYTHONPATH=. python3 scripts/export_gpt_website_retrieval_pool_csv.py\n"
            "Or: PYTHONPATH=. python3 scripts/screening_rank_v1.py "
            "--out scripts/fixtures/gpt_website_retrieval_shortlist_pool.csv --top 500"
        )

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = args.out_dir
    if out_dir is None:
        out_dir = FIXTURE_RUNS_PARENT / ts
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    _, sampled = load_and_sample(inp, args.top_pool, args.sample, args.seed)
    request_companies = build_request_payload(sampled)

    manifest: Dict[str, Any] = {
        "script": "gpt_batch_website_retrieval_test.py",
        "created_at_utc": utc_timestamp_iso(),
        "git_commit": git_commit_hash(REPO_ROOT),
        "chunk_size_target": 20,
        "note": "Production pattern: chunk into ~20-company groups; one Responses call per chunk; no retries on first quality pass.",
        "input_csv": str(inp),
        "input_sha256": sha256_file(inp),
        "top_pool": args.top_pool,
        "sample": args.sample,
        "seed": args.seed,
        "sampled_orgnrs": [c["orgnr"] for c in request_companies],
        "model": model,
        "head_verify": bool(args.head_verify),
    }

    write_json(out_dir / "manifest.json", manifest)
    write_json(out_dir / "request_companies.json", {"companies": request_companies})

    client = OpenAI(api_key=api_key.strip())
    try:
        response, mode_used, structured_rejection = _call_openai_batch(
            client, model, request_companies
        )
    except OpenAIBatchCallError as e:
        err_payload = {
            "error": str(e),
            "structured_format_rejection": e.structured_rejection,
        }
        write_json(out_dir / "response_raw.json", err_payload)
        write_json(out_dir / "parsed.json", {"valid": False, "validation_errors": [str(e)]})
        raise SystemExit(1) from e

    raw_debug = _serialize_response_for_debug(response)
    raw_debug["api_mode"] = mode_used
    raw_debug["structured_format_rejection"] = structured_rejection
    write_json(out_dir / "response_raw.json", raw_debug)

    text = raw_debug.get("output_text") or ""
    parsed_ok: Optional[WebsiteRetrievalBatchResult] = None
    parse_errors: List[str] = []

    try:
        parsed_ok = parse_batch_from_response_text(text)
    except (json.JSONDecodeError, ValidationError) as e:
        parse_errors.append(f"{type(e).__name__}: {e}")

    if parsed_ok is not None:
        expected_n = len(request_companies)
        got_n = len(parsed_ok.items)
        count_ok = got_n == expected_n
        out_parsed: Dict[str, Any] = {
            "valid": True,
            "api_mode": mode_used,
            "expected_count": expected_n,
            "returned_count": got_n,
            "count_ok": count_ok,
            "items": [m.model_dump() for m in parsed_ok.items],
        }
        if args.head_verify:
            out_parsed["head_verify"] = head_verify_urls(parsed_ok.items)
        write_json(out_dir / "parsed.json", out_parsed)
        logger.info("Wrote artifacts under %s (mode=%s)", out_dir, mode_used)
        if not count_ok:
            logger.error(
                "Item count mismatch: expected %d, got %d (see parsed.json)",
                expected_n,
                got_n,
            )
            raise SystemExit(1)
    else:
        write_json(
            out_dir / "parsed.json",
            {
                "valid": False,
                "api_mode": mode_used,
                "validation_errors": parse_errors,
                "raw_output_excerpt": text[:8000],
            },
        )
        logger.error("Parse/validation failed; see parsed.json")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
