#!/usr/bin/env python3
"""
Smoke test OpenAI web search access for this API key.

1) Responses API with ``gpt-4o-search-preview`` (minimal pattern from OpenAI docs — no tools array).
   Many accounts return 404 ``Model not found`` for this id on Responses even though docs list it;
   eligibility can depend on org, tier, or rollout.

2) Responses API with ``gpt-4o`` + ``tools: [{type: web_search}]`` (same pattern as
   ``scripts/gpt_batch_website_retrieval_test.py``).

Usage (repo root):
  PYTHONPATH=. .venv/bin/python3 scripts/smoke_openai_search_preview.py
  PYTHONPATH=. .venv/bin/python3 scripts/smoke_openai_search_preview.py --model gpt-4o-mini-search-preview
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Install openai: pip install openai") from e


def _output_text(resp: object) -> str:
    raw = getattr(resp, "output_text", None)
    if raw:
        return str(raw).strip()
    out = getattr(resp, "output", None) or []
    for item in out:
        if getattr(item, "type", None) != "message":
            continue
        for block in getattr(item, "content", None) or []:
            if getattr(block, "type", None) == "output_text":
                t = getattr(block, "text", None)
                if t:
                    return str(t).strip()
    return ""


def main() -> None:
    ap = argparse.ArgumentParser(description="Smoke test search-preview vs gpt-4o+web_search.")
    ap.add_argument(
        "--model",
        default="gpt-4o-search-preview",
        help="Model for test (1); default gpt-4o-search-preview",
    )
    ap.add_argument(
        "--input",
        default="Find the official website of IKEA Sweden. Reply with one https URL only.",
        help="Prompt for test (1)",
    )
    ap.add_argument(
        "--skip-tool-pattern",
        action="store_true",
        help="Only run search-preview test, not gpt-4o+web_search",
    )
    args = ap.parse_args()

    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=key)
    model = str(args.model).strip()

    print("=== (1) Responses + search-preview model (no tools array) ===", file=sys.stderr)
    print(f"model={model!r}", file=sys.stderr)
    try:
        resp = client.responses.create(model=model, input=args.input)
        text = _output_text(resp)
        print(f"OK id={getattr(resp, 'id', None)}", file=sys.stderr)
        print(text)
    except Exception as e:  # noqa: BLE001
        print(f"FAILED: {type(e).__name__}: {e}", file=sys.stderr)
        if hasattr(e, "response") and e.response is not None:
            try:
                print(getattr(e.response, "text", e.response), file=sys.stderr)
            except Exception:
                pass
        print("", file=sys.stderr)

    if args.skip_tool_pattern:
        raise SystemExit(0)

    print("=== (2) Responses + gpt-4o + web_search tool (Nivo batch pattern) ===", file=sys.stderr)
    try:
        resp2 = client.responses.create(
            model="gpt-4o",
            input=args.input,
            tools=[{"type": "web_search"}],
            tool_choice="required",
        )
        text2 = _output_text(resp2)
        print(f"OK id={getattr(resp2, 'id', None)}", file=sys.stderr)
        print(text2)
    except Exception as e:  # noqa: BLE001
        print(f"FAILED: {type(e).__name__}: {e}", file=sys.stderr)
        raise SystemExit(1) from e


if __name__ == "__main__":
    main()
