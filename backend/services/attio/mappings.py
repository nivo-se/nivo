"""Pure mapping functions: Nivo rows → Attio attribute payloads.

Kept side-effect free so they can be unit tested without httpx or env vars.
The Attio attribute slugs used here are the standard ones for the Companies
and People objects (https://docs.attio.com/docs/standard-objects).
"""

from __future__ import annotations

from typing import Any, Mapping, Optional
from urllib.parse import urlparse


def _extract_domain(website: Optional[str]) -> Optional[str]:
    """Best-effort extraction of a bare domain from a website field.

    Accepts forms like "acme.com", "https://www.acme.com", "www.acme.com/about".
    Returns None if nothing usable is present.
    """
    if not website:
        return None
    raw = website.strip()
    if not raw:
        return None
    if "://" not in raw:
        raw = "http://" + raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower().strip()
    if not host or "." not in host:
        return None
    return host[4:] if host.startswith("www.") else host


def nivo_company_to_attio_values(
    company: Mapping[str, Any],
) -> dict[str, Any]:
    """Build the Attio `values` payload for a `deep_research.companies` row.

    Required: `name`, plus either `website` (parsed to a domain) or an explicit
    `domain` key. Returns a dict ready to pass to `AttioClient.assert_company`.

    Raises ValueError if neither name nor a usable domain is present.
    """
    name = (company.get("name") or "").strip()
    domain = (company.get("domain") or "").strip().lower() or _extract_domain(
        company.get("website")
    )
    if not name and not domain:
        raise ValueError("company requires at least one of {name, website/domain}")

    values: dict[str, Any] = {}
    if name:
        values["name"] = name
    if domain:
        values["domains"] = [{"domain": domain}]
    if company.get("description"):
        values["description"] = str(company["description"]).strip()
    return values


def nivo_contact_to_attio_values(
    contact: Mapping[str, Any],
    *,
    company_attio_record_id: Optional[str] = None,
) -> dict[str, Any]:
    """Build the Attio `values` payload for a `deep_research.contacts` row.

    Email is mandatory because `assert_person` matches on email_addresses.
    Optionally links to the parent company via record reference.
    """
    email = (contact.get("email") or "").strip().lower()
    if not email:
        raise ValueError("contact requires an email address")

    values: dict[str, Any] = {
        "email_addresses": [{"email_address": email}],
    }

    first = (contact.get("first_name") or "").strip()
    last = (contact.get("last_name") or "").strip()
    full = (contact.get("full_name") or "").strip()
    if first or last:
        values["name"] = [{"first_name": first or None, "last_name": last or None}]
    elif full:
        # Attio personal_name expects first/last; degrade by splitting on the
        # last whitespace if no structured name is available.
        parts = full.rsplit(" ", 1)
        if len(parts) == 2:
            values["name"] = [{"first_name": parts[0], "last_name": parts[1]}]
        else:
            values["name"] = [{"first_name": full, "last_name": None}]

    if contact.get("title"):
        values["job_title"] = str(contact["title"]).strip()

    if contact.get("phone"):
        values["phone_numbers"] = [{"original_phone_number": str(contact["phone"]).strip()}]

    if contact.get("linkedin_url"):
        values["linkedin"] = str(contact["linkedin_url"]).strip()

    if company_attio_record_id:
        values["company"] = [
            {"target_object": "companies", "target_record_id": company_attio_record_id}
        ]

    return values


def extract_record_id(assert_response: Mapping[str, Any]) -> Optional[str]:
    """Pull the record_id out of an assert/create response.

    Attio responses follow the shape `{"data": {"id": {"record_id": "..."}}}`.
    Returns None if the shape is unexpected so callers can decide to log + skip
    rather than crash.
    """
    data = assert_response.get("data") or {}
    ident = data.get("id") or {}
    record_id = ident.get("record_id")
    return str(record_id) if record_id else None
