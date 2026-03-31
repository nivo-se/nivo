#!/usr/bin/env python3
"""
Create a NEW domain in Resend (does not rename an existing one).

Resend does not support renaming domains via API. To use send.nivogroup.se you:
  1. POST /domains with {"name": "send.nivogroup.se", ...}
  2. Add DNS records in Cloudflare (use resend_dns_check.py after create)
  3. If your plan allows only one domain, remove the old domain in the dashboard
     or DELETE /domains/:id (careful — breaks sending until the new domain verifies)

Usage:
  export RESEND_API_KEY=re_...   # full-access key
  python3 scripts/resend_domain_create.py send.nivogroup.se

Optional:
  python3 scripts/resend_domain_create.py send.nivogroup.se --region eu-west-1

Docs: https://resend.com/docs/api-reference/domains/create-domain
"""

from __future__ import annotations

import argparse
import json
import os
import sys
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
    sys.exit("Set RESEND_API_KEY or add to .env")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("name", help="Domain name, e.g. send.nivogroup.se")
    p.add_argument("--region", default="", help="eu-west-1, us-east-1, ... (optional)")
    args = p.parse_args()

    token = load_key()
    body: dict = {"name": args.name.strip()}
    if args.region:
        body["region"] = args.region

    req = urllib.request.Request(
        "https://api.resend.com/domains",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "nivo-web-scripts/resend_domain_create",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            out = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        sys.exit(e.code)

    data = out.get("data") or out
    print(json.dumps(data, indent=2))
    print(
        "\nNext: add the printed DNS records in Cloudflare, then verify in Resend.\n"
        "Run: python3 scripts/resend_dns_check.py",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
