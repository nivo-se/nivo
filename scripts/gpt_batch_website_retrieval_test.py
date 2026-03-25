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

  # One-off: top 500 → 20 calls × 25 companies → merged_urls.csv:
  PYTHONPATH=. python3 scripts/gpt_batch_website_urls_500.py --out-dir /tmp/gpt500_urls

Requires: OPENAI_API_KEY, pydantic, openai, httpx. CSV is read with the stdlib (no pandas required).

Default model is ``gpt-5.4-nano`` (Responses + web_search + structured outputs). Override with
``--model`` or ``GPT_WEBSITE_RETRIEVAL_MODEL`` (e.g. ``gpt-4o`` if needed).

Some API keys return 404 for ``gpt-4o-search-preview`` on **Responses**; that model works on **Chat
Completions** with built-in search. Use ``--chat-search`` (model default
``gpt-4o-search-preview``, override with ``--model`` or ``GPT_CHAT_SEARCH_MODEL``).

Quality-first prompts (full instructions); compact input JSON saves tokens without changing meaning.
``max_output_tokens`` default 8192 (override ``GPT_BATCH_MAX_OUTPUT_TOKENS``). Latency is still mostly
``web_search``, not generation.

Web search uses ``user_location`` (Sweden) so results favor Swedish domains and local listings. For
higher URL recall than ``gpt-5.4-nano``, set ``GPT_WEBSITE_RETRIEVAL_MODEL=gpt-4o`` (or another
Responses-capable model your key supports).
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

DEFAULT_MODEL = "gpt-5.4-nano"
DEFAULT_CHAT_SEARCH_MODEL = "gpt-4o-search-preview"
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


def _responses_text_config() -> Dict[str, Any]:
    """``text=`` value for ``responses.create``: structured JSON only (no verbosity constraint)."""
    block = openai_website_batch_json_schema()
    return {
        "format": {
            "type": "json_schema",
            "name": block["name"],
            "strict": block["strict"],
            "schema": block["schema"],
        },
    }


# Cap generation latency for large batches (25+ rows); raise via env if JSON truncates.
_DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("GPT_BATCH_MAX_OUTPUT_TOKENS", "8192"))


def _web_search_tools() -> List[Dict[str, Any]]:
    """Swedish-biased web search (ISO country SE) for Bolagsverket-style company lookups."""
    if (os.getenv("GPT_WEBSITE_RETRIEVAL_NO_USER_LOCATION") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return [{"type": "web_search"}]
    return [
        {
            "type": "web_search",
            "user_location": {
                "type": "approximate",
                "country": "SE",
                "city": "Stockholm",
                "timezone": "Europe/Stockholm",
            },
        }
    ]


def _responses_create_speed_kwargs() -> Dict[str, Any]:
    return {
        "max_output_tokens": _DEFAULT_MAX_OUTPUT_TOKENS,
        "text": _responses_text_config(),
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


def load_ranked_head(path: Path, n: int) -> List[Dict[str, str]]:
    """Load CSV, sort by rank/total_score, return the first ``n`` rows (no random sampling)."""
    rows = _read_csv_rows(path)
    rows = _sort_pool_rows(rows)
    head = rows[: int(n)]
    if len(head) < int(n):
        raise SystemExit(
            f"CSV has only {len(head)} rows after sort; need at least {n}. "
            "Regenerate with screening_rank_v1 --top 500 or export_gpt_website_retrieval_pool_csv.py."
        )
    return head


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


def build_request_payload(sampled: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """Build per-company objects for the model; optional DB/registry fields when present on CSV."""
    out: List[Dict[str, Any]] = []
    optional_keys = (
        "registry_homepage_url",
        "address_city",
        "address_region",
        "address_country",
        "primary_nace",
        "segment_labels_json",
    )
    for row in sampled:
        name = (row.get("company_name") or "").strip()
        org_raw = (row.get("orgnr") or "").strip()
        item: Dict[str, Any] = {"name": name, "orgnr": _fix_orgnr_format(org_raw)}
        for k in optional_keys:
            v = (row.get(k) or "").strip()
            if v:
                item[k] = v
        out.append(item)
    return out


SYSTEM_PROMPT = """You are a research assistant resolving official corporate websites for Swedish
limited companies (Aktiebolag). Input is legal name plus Swedish orgnr (format XXXXXX-XXXX).

Optional fields may be present from our database (Bolagsverket/Allabolag-style enrichment):
registry_homepage_url (known URL on file — treat as a strong hint only: confirm it is live, uses
https, and matches this legal entity before adopting it as official_website_url; if it is wrong or
a directory, search for the real site), address_city, address_region, address_country, primary_nace
(industry code), segment_labels_json (industry tag JSON text). Use location and industry to
disambiguate similar company names and to compose search queries; default country is Sweden when
orgnr is Swedish.

Use web search actively: for EACH company run multiple focused queries before giving up — combine
legal name, distinctive tokens from the name, orgnr with and without hyphen, and Swedish terms such
as "hemsida", "kontakt", "official site", "företaget". For names ending in "Nordic AB", "Sweden AB",
"Sverige AB", or similar, also search the core brand or product line and the apparent parent group;
the public site may use a group domain while still being the right corporate front door.

Brand vs legal name: The Bolagsverket name may differ from the customer-facing brand (e.g.
manufacturers selling under a product family name). Use primary_nace and segment_labels_json to
guess trade names; search those plus "about", "företaget", orgnr. Prefer the domain whose About,
Contact, or footer ties to THIS legal entity (orgnr or exact legal name) — even if the domain looks
unrelated to the registered name (e.g. international product site for a Swedish AB).

Regional subsidiaries (e.g. "MVB Umeå AB"): Prefer a URL for that unit if it exists; otherwise a
regional or group site that explicitly lists this legal name or orgnr. Do not pick a short generic
domain on acronym match alone if content does not refer to this company (risk of wrong owner).

registry_homepage_url vs search: If the registry URL is wrong or generic but search finds a clearer
official site (especially with orgnr on-page), prefer the clearer site. If registry matches the
live entity after verification, you may use it.

Holding / parent: If the AB has no standalone site but the parent or group site documents this
entity, the group URL is acceptable; use confidence ~0.45–0.65 and say "group/holding site" in
source_note.

When to return empty: If, after several queries, you only see directories, name collisions, or no
page plausibly tied to this orgnr/legal name, set official_website_url="" with low confidence.
Never invent plausible domains (e.g. concatenating name tokens + .se) without search evidence that
the site belongs to this company.

Target: the company's own primary website (https), not third-party directories or social profiles.
Reject as official_website_url: allabolag.se, proff.se, bolagsfakta.se, kreditrapporten.se,
ratsit.se, merinfo.se, eniro.se, hitta.se, linkedin.com, facebook.com, instagram.com, and pure news
articles. If the best match is a global .com with clear branding for that Swedish entity, that is OK.

Do NOT leave official_website_url empty only because the orgnr is missing from the homepage snippet.
If search results show a domain that clearly belongs to this company (matching name, product, or
registered trade name), return that https root URL with honest confidence: use roughly 0.35–0.65 when
the link is plausible but orgnr is not verified on-page, and higher when terms/privacy/contact pages
cite the orgnr or legal name.

Reserve official_website_url="" for cases where, after several distinct queries, there is still no
reasonable domain — not when you merely saw directory pages.

Every output row must use the exact orgnr and company_name from the input list (same order)."""


def _companies_json_compact(companies: List[Dict[str, str]]) -> str:
    return json.dumps(companies, ensure_ascii=False, separators=(",", ":"))


def _user_prompt(companies_json: str, expect_count: int) -> str:
    return f"""Companies (JSON array). Each object has \"name\" and \"orgnr\"; optional keys may
include registry_homepage_url, address_city, address_region, address_country, primary_nace,
segment_labels_json when available:
{companies_json}

Work through the list in order. For each company, use web search until you have either (a) a
defensible https official_website_url or (b) strong evidence that no public site exists. Prefer
empty string over a guessed domain when you cannot tie a URL to this orgnr/legal name. When you
choose a brand or group site, say so briefly in source_note (e.g. "product brand site, same entity
in About" or "group site lists subsidiary").

Return a JSON object with key \"items\": an array of exactly {expect_count} objects, one per company
above, same order as given. Each object must include: orgnr, company_name, official_website_url
(https URL or empty string only if truly none found), confidence_0_1 (0-1), source_note (brief:
which queries/signals led to the URL, or why it is empty)."""


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


def _chat_completion_output_text(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""
    msg = getattr(choices[0], "message", None)
    if msg is None:
        return ""
    return str(getattr(msg, "content", None) or "").strip()


def serialize_batch_api_response(response: Any) -> Dict[str, Any]:
    """Responses API or Chat Completions — unified debug dict with ``output_text``."""
    if getattr(response, "choices", None):
        out: Dict[str, Any] = {
            "id": getattr(response, "id", None),
            "model": getattr(response, "model", None),
            "output_text": _chat_completion_output_text(response),
        }
        usage = getattr(response, "usage", None)
        if usage is not None and hasattr(usage, "model_dump"):
            out["usage"] = usage.model_dump()
        elif usage is not None:
            out["usage"] = str(usage)
        out["api_kind"] = "chat_completions"
        return out
    out = _serialize_response_for_debug(response)
    out["api_kind"] = "responses"
    return out


def batch_response_output_text(response: Any) -> str:
    if getattr(response, "choices", None):
        return _chat_completion_output_text(response)
    return _response_output_text(response)


class OpenAIBatchCallError(Exception):
    """Raised when both structured and fallback Responses calls fail."""

    def __init__(self, message: str, *, structured_rejection: Optional[str] = None) -> None:
        super().__init__(message)
        self.structured_rejection = structured_rejection


def _call_openai_batch(
    client: OpenAI,
    model: str,
    companies: List[Dict[str, Any]],
) -> Tuple[Any, str, Optional[str]]:
    """
    Returns (response, mode_used, structured_format_rejection).
    mode_used: \"structured\" if response_format applied, else \"fallback_parse\".
    structured_format_rejection is set when fallback was used after the first call rejected.
    """
    companies_json = _companies_json_compact(companies)
    expect_count = len(companies)
    user_text = _user_prompt(companies_json, expect_count)
    input_messages = [
        {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
        {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
    ]
    kwargs: Dict[str, Any] = {
        "model": model,
        "input": input_messages,
        "tools": _web_search_tools(),
        "tool_choice": "required",
    }
    structured_error: Optional[str] = None
    try:
        kwargs_fmt = {**kwargs, **_responses_create_speed_kwargs()}
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
            tools=_web_search_tools(),
            tool_choice="required",
            **_responses_create_speed_kwargs(),
        )
    except Exception as e2:  # noqa: BLE001
        raise OpenAIBatchCallError(
            f"{type(e2).__name__}: {e2}",
            structured_rejection=structured_error,
        ) from e2
    return resp, "fallback_parse", structured_error


def _call_openai_batch_chat_search(
    client: OpenAI,
    model: str,
    companies: List[Dict[str, Any]],
) -> Tuple[Any, str, None]:
    """
    Chat Completions + ``gpt-4o-search-preview`` / ``gpt-4o-mini-search-preview`` (built-in web search).
    Same strict JSON schema as the Responses path. Use when Responses returns 404 for search-preview models.
    """
    companies_json = _companies_json_compact(companies)
    expect_count = len(companies)
    user_text = _user_prompt(companies_json, expect_count)
    block = openai_website_batch_json_schema()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": block["name"],
                    "strict": block["strict"],
                    "schema": block["schema"],
                },
            },
        )
        return resp, "chat_completions_search_json_schema", None
    except Exception as e:  # noqa: BLE001
        raise OpenAIBatchCallError(f"{type(e).__name__}: {e}") from e


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
        help="OpenAI model (default: env GPT_WEBSITE_RETRIEVAL_MODEL or gpt-5.4-nano)",
    )
    parser.add_argument(
        "--head-verify",
        action="store_true",
        help="After parse, HEAD each official_website_url (short timeout per URL)",
    )
    parser.add_argument(
        "--chat-search",
        action="store_true",
        help=(
            "Use Chat Completions with a search-preview model (built-in search), not Responses + "
            "web_search tool. Default model: gpt-4o-search-preview (env GPT_CHAT_SEARCH_MODEL, --model)."
        ),
    )
    args = parser.parse_args()
    _load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not str(api_key).strip():
        raise SystemExit("OPENAI_API_KEY is not set")

    if args.chat_search:
        model = (
            (args.model or os.getenv("GPT_CHAT_SEARCH_MODEL") or DEFAULT_CHAT_SEARCH_MODEL).strip()
        )
    else:
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
        "web_search_sweden_user_location": (not args.chat_search)
        and not (
            (os.getenv("GPT_WEBSITE_RETRIEVAL_NO_USER_LOCATION") or "").strip().lower()
            in ("1", "true", "yes")
        ),
        "api": "chat_completions_search" if args.chat_search else "responses_web_search_tool",
    }

    write_json(out_dir / "manifest.json", manifest)
    write_json(out_dir / "request_companies.json", {"companies": request_companies})

    client = OpenAI(api_key=api_key.strip())
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
            "error": str(e),
            "structured_format_rejection": e.structured_rejection,
        }
        write_json(out_dir / "response_raw.json", err_payload)
        write_json(out_dir / "parsed.json", {"valid": False, "validation_errors": [str(e)]})
        raise SystemExit(1) from e

    raw_debug = serialize_batch_api_response(response)
    raw_debug["api_mode"] = mode_used
    raw_debug["structured_format_rejection"] = structured_rejection
    write_json(out_dir / "response_raw.json", raw_debug)

    text = batch_response_output_text(response) or raw_debug.get("output_text") or ""
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
