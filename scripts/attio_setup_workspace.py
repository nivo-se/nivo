#!/usr/bin/env python3
"""One-shot Attio workspace setup for Nivo.

Verifies the API key works and prints the workspace identity. In future
revisions this script will also create the custom attribute `nivo_company_id`
on the Companies object so we can assert by it instead of (or in addition to)
the `domains` attribute.

Usage:
    cd /path/to/nivo
    export ATTIO_API_KEY=<your key>
    python3 scripts/attio_setup_workspace.py

Requires: httpx (backend/requirements.txt)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        return
    _load(dotenv_path=env_path)


def main() -> int:
    _load_dotenv()

    if not os.environ.get("ATTIO_API_KEY", "").strip():
        print("❌ ATTIO_API_KEY is not set.")
        print("   Generate one at https://app.attio.com → Settings → Developers → API key.")
        return 1

    from backend.services.attio import AttioClient, AttioError

    try:
        with AttioClient() as client:
            info = client.identify()
    except AttioError as exc:
        print(f"❌ Attio identify failed: {exc}")
        return 1

    # /v2/self returns flat fields (per the OpenAPI spec); legacy shapes nested
    # under "workspace" are tolerated here for forward compatibility.
    workspace_id = (
        info.get("workspace_id")
        or (info.get("workspace") or {}).get("id")
        or "<unknown>"
    )
    workspace_name = (
        info.get("workspace_name")
        or (info.get("workspace") or {}).get("name")
        or "<unnamed>"
    )
    workspace_slug = info.get("workspace_slug") or ""
    scopes = info.get("scope") or info.get("scopes") or ""

    print("✅ Attio API key works.")
    print(f"   Workspace : {workspace_name} ({workspace_id})")
    if workspace_slug:
        print(f"   URL       : https://app.attio.com/{workspace_slug}")
    if scopes:
        scopes_text = " ".join(scopes) if isinstance(scopes, list) else scopes
        print(f"   Scopes    : {scopes_text}")
    print()
    print("Next: send one company ad-hoc (no bulk pushes — Attio is curated):")
    print("   python3 scripts/attio_send_company.py --orgnr <orgnr> --dry-run")
    print("   ATTIO_SYNC_ENABLED=true python3 scripts/attio_send_company.py --orgnr <orgnr>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
