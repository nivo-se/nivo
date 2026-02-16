#!/usr/bin/env python3
"""
Runbook verification: gather the 4 answers needed for enrichment pipeline debugging.

Usage:
  BASE_URL=http://localhost:8000 python3 scripts/verify_enrichment_pipeline.py

If STATUS needs auth, run locally with REQUIRE_AUTH=false first.
"""
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE = os.getenv("BASE_URL", "http://localhost:8000")


def _get(url: str) -> dict:
    req = Request(url, headers={"Accept": "application/json"})
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def main():
    print("=" * 60)
    print("1) GET /api/status – counts")
    print("=" * 60)
    try:
        data = _get(f"{BASE}/api/status")
        print(f"db_source: {data.get('db_source', '?')}")
        print(f"db_ok: {data.get('db_ok', False)}")
        counts = data.get("counts", {})
        for t in ["company_enrichment", "ai_profiles", "enrichment_runs"]:
            print(f"counts.{t}: {counts.get(t, 'N/A')}")
        print()
    except (URLError, HTTPError, OSError, json.JSONDecodeError) as e:
        print(f"Error: {e}")
        print("(If behind auth, run locally with REQUIRE_AUTH=false)\n")

    print("=" * 60)
    print("2) Golden orgnr (from get_intel_orgnr.py)")
    print("=" * 60)
    script = Path(__file__).parent / "get_intel_orgnr.py"
    try:
        out = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).resolve().parents[1],
            env={**os.environ, "DATABASE_SOURCE": os.getenv("DATABASE_SOURCE", "postgres")},
        )
        orgnr = (out.stdout or "").strip()
        if orgnr:
            print(f"Golden orgnr: {orgnr}\n")
        else:
            print("No company_enrichment rows found. Run enrichment first.\n")
            orgnr = None
    except Exception as e:
        print(f"Error: {e}\n")
        orgnr = None

    if orgnr:
        print("=" * 60)
        print(f"3) GET /api/companies/{orgnr}/intel (first ~30 lines)")
        print("=" * 60)
        try:
            data = _get(f"{BASE}/api/companies/{orgnr}/intel")
            # Pretty-print but truncate content for readability
            truncated = dict(data)
            if "artifacts" in truncated:
                for a in truncated.get("artifacts", [])[:3]:
                    if "content" in a and len(str(a["content"])) > 200:
                        a["content"] = str(a["content"])[:200] + "..."
            lines = json.dumps(truncated, indent=2).split("\n")
            for line in lines[:35]:
                print(line)
            if len(lines) > 35:
                print("...")
            print()
        except (URLError, HTTPError, OSError, json.JSONDecodeError) as e:
            print(f"Error: {e}\n")

    print("=" * 60)
    print("4) Fill in and reply:")
    print("=" * 60)
    print("  • Where is the backend running? (local / Railway / Render / Fly / VPS)")
    print("  • counts.company_enrichment = ?  counts.ai_profiles = ?")
    print("  • Golden orgnr = ?  (paste first ~30 lines of /intel above)")
    print("  • First page to fix: list / company detail / deep dive")


if __name__ == "__main__":
    main()
