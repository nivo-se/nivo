"""
Parse reply+<token>@reply.<domain> recipients.
Keep logic aligned with frontend/server/services/crm/reply-to-address.ts
"""

from __future__ import annotations

import re

TOKEN_RE = re.compile(r"^[a-f0-9]{32}$")


def validate_thread_token_format(token: str) -> bool:
    return bool(token and TOKEN_RE.match(token))


def parse_thread_token_from_recipient(recipient: str, expected_reply_domain: str) -> str | None:
    trimmed = recipient.strip()
    if "@" not in trimmed:
        return None
    local, _, domain = trimmed.rpartition("@")
    domain_l = domain.strip().lower()
    if domain_l != expected_reply_domain.strip().lower():
        return None
    local_l = local.strip().lower()
    prefix = "reply+"
    if not local_l.startswith(prefix):
        return None
    token = local_l[len(prefix) :]
    return token if validate_thread_token_format(token) else None


def find_reply_recipient(recipients: list[str], expected_reply_domain: str) -> str | None:
    dom = expected_reply_domain.strip().lower()
    for r in recipients:
        if "@" not in r:
            continue
        _, _, d = r.strip().rpartition("@")
        if d.lower() == dom:
            return r.strip()
    return None
