"""Build the "send to Attio" bundle from Postgres.

Shared by:
  * `scripts/attio_send_company.py` (CLI, ad-hoc per-company push)
  * `backend/api/attio.py`           (POST /api/attio/send-company/{id} endpoint)

Read-only against Postgres; never calls Attio. Caller is responsible for
passing the resulting bundle to `push.send_company_to_attio` and persisting the
returned record_ids back into `deep_research.companies.attio_record_id` /
`deep_research.contacts.attio_record_id`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class CompanyBundle:
    """A snapshot of one company plus the data we want to surface in Attio.

    `company` and `contacts` are dicts (not models) so this works against any
    cursor cleanly without importing ORMs.
    """

    company: dict[str, Any]
    contacts: list[dict[str, Any]]
    research_summary_markdown: Optional[str]


_COMPANY_COLUMNS = (
    "id, orgnr, name, website, country_code, headquarters, industry, attio_record_id"
)
_CONTACT_COLUMNS = (
    "id, full_name, first_name, last_name, title, email, "
    "linkedin_url, phone, attio_record_id"
)


def load_company_by_id(cur, company_id: str) -> Optional[dict[str, Any]]:
    cur.execute(
        f"SELECT {_COMPANY_COLUMNS} FROM deep_research.companies WHERE id = %s",
        (company_id,),
    )
    return _row_to_dict(cur)


def load_company_by_orgnr(cur, orgnr: str) -> Optional[dict[str, Any]]:
    cur.execute(
        f"SELECT {_COMPANY_COLUMNS} FROM deep_research.companies WHERE orgnr = %s",
        (orgnr,),
    )
    return _row_to_dict(cur)


def load_contacts(cur, company_uuid: str) -> list[dict[str, Any]]:
    cur.execute(
        f"SELECT {_CONTACT_COLUMNS} FROM deep_research.contacts "
        "WHERE company_id = %s ORDER BY is_primary DESC, created_at",
        (company_uuid,),
    )
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def build_research_summary(cur, company_uuid: str) -> Optional[str]:
    """Markdown summary built from the most recent analysis run + profile.

    Returns None if there's nothing to say (e.g. company hasn't been
    researched yet) so the caller can decide to skip the note entirely.
    """
    cur.execute(
        """
        SELECT id, run_type, status, created_at
        FROM deep_research.analysis_runs
        WHERE company_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (company_uuid,),
    )
    run = cur.fetchone()
    if not run:
        return None

    run_id, run_type, status, created_at = run
    lines = [
        "# Nivo research summary",
        "",
        f"- Latest analysis run: `{run_id}`",
        f"- Type: **{run_type}** · Status: **{status}**",
        f"- Created: {created_at:%Y-%m-%d %H:%M UTC}",
    ]

    cur.execute(
        "SELECT summary FROM deep_research.company_profiles "
        "WHERE company_id = %s ORDER BY updated_at DESC LIMIT 1",
        (company_uuid,),
    )
    prof = cur.fetchone()
    if prof and prof[0]:
        lines += ["", "## Company profile", "", prof[0].strip()]

    return "\n".join(lines)


def load_bundle(
    cur,
    *,
    company_id: Optional[str] = None,
    orgnr: Optional[str] = None,
    include_research_summary: bool = True,
) -> Optional[CompanyBundle]:
    """One-call helper. Returns None if the company is not found."""
    if company_id:
        company = load_company_by_id(cur, company_id)
    elif orgnr:
        company = load_company_by_orgnr(cur, orgnr)
    else:
        raise ValueError("either company_id or orgnr is required")

    if not company:
        return None

    contacts = load_contacts(cur, company["id"])
    summary = (
        build_research_summary(cur, company["id"])
        if include_research_summary
        else None
    )
    return CompanyBundle(
        company=company,
        contacts=contacts,
        research_summary_markdown=summary,
    )


def persist_record_ids(cur, *, company_uuid: str, result) -> None:
    """Cache returned Attio record_ids back into Postgres.

    Idempotent: only writes when the value actually changed.
    `result` is a `push.SendResult`.
    """
    if result.company_record_id:
        cur.execute(
            "UPDATE deep_research.companies SET attio_record_id = %s, updated_at = NOW() "
            "WHERE id = %s AND attio_record_id IS DISTINCT FROM %s",
            (result.company_record_id, company_uuid, result.company_record_id),
        )
    for email, rec_id in result.contact_record_ids.items():
        cur.execute(
            "UPDATE deep_research.contacts SET attio_record_id = %s, updated_at = NOW() "
            "WHERE company_id = %s AND lower(email) = %s "
            "AND attio_record_id IS DISTINCT FROM %s",
            (rec_id, company_uuid, email, rec_id),
        )


def _row_to_dict(cur) -> Optional[dict[str, Any]]:
    row = cur.fetchone()
    if not row:
        return None
    cols = [c.name for c in cur.description]
    return dict(zip(cols, row))
