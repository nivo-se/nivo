#!/usr/bin/env python3
"""
Print Resend domain list + expected DNS records (same data as dashboard).

Requires RESEND_API_KEY with permission to read domains (use a Full access key;
"sending only" keys may return 401/403 on GET /domains).

Usage:
  export RESEND_API_KEY=re_...
  python3 scripts/resend_dns_check.py

Or load from repo root .env (first RESEND_API_KEY= line):
  python3 scripts/resend_dns_check.py

Resend API docs:
  GET https://api.resend.com/domains
  GET https://api.resend.com/domains/:id

Cloudflare: create records in zone nivogroup.se using the "name" column as the
hostname relative to the zone (Resend shows names like "send", "resend._domainkey").
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_key() -> str:
    key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if key:
        return key
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("RESEND_API_KEY=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip()
    print("Set RESEND_API_KEY or add it to .env", file=sys.stderr)
    sys.exit(1)


def api_get(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            # Resend may reject requests without User-Agent (403 / error 1010)
            "User-Agent": "nivo-web-scripts/resend_dns_check",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    token = load_key()
    base = "https://api.resend.com/domains"
    try:
        listing = api_get(base, token)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} listing domains: {body[:500]}", file=sys.stderr)
        print(
            "\nTip: create a new API key in Resend with Full access, or ensure the key "
            "can read Domains (sending-only keys often cannot call GET /domains).",
            file=sys.stderr,
        )
        sys.exit(1)

    data = listing.get("data") or []
    if not data:
        print("No domains in this Resend account.")
        return

    for d in data:
        did = d.get("id")
        name = d.get("name")
        caps = d.get("capabilities") or {}
        print(f"\n=== {name} (id={did}) status={d.get('status')} capabilities={caps} ===\n")
        if caps.get("receiving") == "disabled":
            print(
                "  Note: receiving is disabled in the API — inbound (receiving) MX records are "
                "listed only after you enable Receiving on this domain in the Resend dashboard "
                "and the capability updates.\n"
            )

        detail = api_get(f"{base}/{did}", token)
        dom = detail.get("data") or detail
        records = dom.get("records") or []
        for rec in records:
            rtype = rec.get("type")
            rname = rec.get("name")
            status = rec.get("status")
            value = rec.get("value", "")
            rec_label = rec.get("record", "")
            line = f"  [{rec_label or rtype}] {rtype} name={rname!r} status={status!r}"
            pri = rec.get("priority")
            if pri is not None:
                line += f" priority={pri}"
            print(line)
            if len(value) > 300:
                print(f"      value={value[:297]}...")
            else:
                print(f"      value={value!r}")
        print()


if __name__ == "__main__":
    main()
