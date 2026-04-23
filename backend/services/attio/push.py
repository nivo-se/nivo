"""High-level idempotent push operations.

Call sites should not reach for `AttioClient` directly — use these helpers so
the `ATTIO_SYNC_ENABLED` feature flag is honored uniformly and so we can layer
in batching, dedup, or queueing later without changing call sites.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional

from .client import AttioClient, AttioError
from .mappings import (
    extract_record_id,
    nivo_company_to_attio_values,
    nivo_contact_to_attio_values,
)

logger = logging.getLogger(__name__)

NOTE_TITLE_RESEARCH = "Nivo Research"
NOTE_TITLE_VALUATION = "Nivo Valuation"


@dataclass
class SendResult:
    """Outcome of a `send_company_to_attio` call.

    Designed so callers can persist the returned ids back into Postgres and
    surface a per-step error report without having to catch individual
    exceptions for each contact / note.
    """

    skipped: bool = False  # True when ATTIO_SYNC_ENABLED is not "true"
    company_record_id: Optional[str] = None
    contact_record_ids: dict[str, str] = field(default_factory=dict)  # email → record_id
    note_record_ids: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.skipped and not self.errors and self.company_record_id is not None


def is_enabled() -> bool:
    """Return True iff the operator has explicitly opted in to pushing.

    Default is OFF so importing this module from any code path is always safe.
    """
    return os.environ.get("ATTIO_SYNC_ENABLED", "").strip().lower() == "true"


def assert_company(
    company: Mapping[str, Any],
    *,
    client: Optional[AttioClient] = None,
) -> Optional[str]:
    """Push a company; return its Attio record_id (or None when disabled).

    `company` should be a dict with at least `name` and one of `website`/
    `domain`. Safe to call repeatedly for the same row.
    """
    if not is_enabled():
        logger.debug("attio push skipped: ATTIO_SYNC_ENABLED!=true")
        return None

    values = nivo_company_to_attio_values(company)
    owns_client = client is None
    client = client or AttioClient()
    try:
        response = client.assert_company(values=values)
    except AttioError:
        logger.exception("attio assert_company failed name=%r", company.get("name"))
        raise
    finally:
        if owns_client:
            client.close()
    return extract_record_id(response)


def assert_person(
    contact: Mapping[str, Any],
    *,
    company_attio_record_id: Optional[str] = None,
    client: Optional[AttioClient] = None,
) -> Optional[str]:
    """Push a contact; return its Attio record_id (or None when disabled)."""
    if not is_enabled():
        logger.debug("attio push skipped: ATTIO_SYNC_ENABLED!=true")
        return None

    values = nivo_contact_to_attio_values(
        contact, company_attio_record_id=company_attio_record_id
    )
    owns_client = client is None
    client = client or AttioClient()
    try:
        response = client.assert_person(values=values)
    except AttioError:
        logger.exception("attio assert_person failed email=%r", contact.get("email"))
        raise
    finally:
        if owns_client:
            client.close()
    return extract_record_id(response)


def add_research_note(
    *,
    company_attio_record_id: str,
    body_markdown: str,
    title: str = NOTE_TITLE_RESEARCH,
    client: Optional[AttioClient] = None,
) -> Optional[str]:
    """Append a research-summary note to a Company record.

    Phase 1A intentionally accepts duplicate notes if called multiple times for
    the same run; dedup will land in Phase 1B once we know the actual
    duplication rate in production.
    """
    if not is_enabled():
        logger.debug("attio push skipped: ATTIO_SYNC_ENABLED!=true")
        return None

    timestamped_title = f"{title} — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    owns_client = client is None
    client = client or AttioClient()
    try:
        response = client.create_note(
            parent_object="companies",
            parent_record_id=company_attio_record_id,
            title=timestamped_title,
            content_markdown=body_markdown,
        )
    except AttioError:
        logger.exception(
            "attio create_note failed company_record_id=%s", company_attio_record_id
        )
        raise
    finally:
        if owns_client:
            client.close()
    return extract_record_id(response)


def send_company_to_attio(
    *,
    company: Mapping[str, Any],
    contacts: Iterable[Mapping[str, Any]] = (),
    research_summary_markdown: Optional[str] = None,
    valuation_summary_markdown: Optional[str] = None,
    client: Optional[AttioClient] = None,
) -> SendResult:
    """Top-level "send a research bundle to Attio" entry point.

    Orchestrates the full push for one company:
      1. assert the company (idempotent on `domains`)
      2. assert each contact (idempotent on `email_addresses`), linking to the
         company once we know its record_id
      3. optionally append a "Nivo Research" note and/or a "Nivo Valuation"
         note on the company

    Failures on contacts/notes do NOT abort the whole bundle — they're logged,
    appended to `result.errors`, and the function continues so partial success
    is observable. The company assert is treated as a hard prerequisite: if it
    fails, contacts and notes are skipped.

    Returns a `SendResult` describing what happened. When sync is disabled,
    returns `SendResult(skipped=True)` without doing any work.
    """
    result = SendResult()

    if not is_enabled():
        logger.debug("attio send_company_to_attio skipped: ATTIO_SYNC_ENABLED!=true")
        result.skipped = True
        return result

    owns_client = client is None
    client = client or AttioClient()
    try:
        try:
            result.company_record_id = assert_company(company, client=client)
        except AttioError as exc:
            result.errors.append(f"company: {exc}")
            return result

        if not result.company_record_id:
            result.errors.append("company: assert returned no record_id")
            return result

        for contact in contacts:
            email = (contact.get("email") or "").strip().lower()
            if not email:
                result.errors.append("contact: missing email — skipped")
                continue
            try:
                rec_id = assert_person(
                    contact,
                    company_attio_record_id=result.company_record_id,
                    client=client,
                )
            except AttioError as exc:
                result.errors.append(f"contact {email}: {exc}")
                continue
            if rec_id:
                result.contact_record_ids[email] = rec_id

        if research_summary_markdown:
            try:
                note_id = add_research_note(
                    company_attio_record_id=result.company_record_id,
                    body_markdown=research_summary_markdown,
                    title=NOTE_TITLE_RESEARCH,
                    client=client,
                )
                if note_id:
                    result.note_record_ids.append(note_id)
            except AttioError as exc:
                result.errors.append(f"research note: {exc}")

        if valuation_summary_markdown:
            try:
                note_id = add_research_note(
                    company_attio_record_id=result.company_record_id,
                    body_markdown=valuation_summary_markdown,
                    title=NOTE_TITLE_VALUATION,
                    client=client,
                )
                if note_id:
                    result.note_record_ids.append(note_id)
            except AttioError as exc:
                result.errors.append(f"valuation note: {exc}")
    finally:
        if owns_client:
            client.close()

    logger.info(
        "attio send_company_to_attio company_record_id=%s contacts=%d notes=%d errors=%d",
        result.company_record_id,
        len(result.contact_record_ids),
        len(result.note_record_ids),
        len(result.errors),
    )
    return result
