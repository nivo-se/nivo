"""Attio integration HTTP endpoints (ad-hoc only — no bulk).

Surface intentionally minimal: one endpoint to push a single curated company
into Attio. Trigger is always human (button in Nivo UI or CLI), never a
background job.

POST /api/attio/send-company/{company_id}
    Push the company + its contacts + most recent research summary into Attio.
    Idempotent: assert endpoints upsert by domain/email; re-running just
    refreshes Attio with the latest values.

Returns 503 when ATTIO_SYNC_ENABLED is not set, so the UI can show a clear
"sync is off" state instead of silently no-op'ing.
"""

from __future__ import annotations

import logging
import os

import psycopg2
from fastapi import APIRouter, HTTPException, Path

from ..services.attio.loader import load_bundle, persist_record_ids
from ..services.attio.push import is_enabled as attio_is_enabled
from ..services.attio.push import send_company_to_attio
from ..services.postgres_db_service import _make_conn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attio", tags=["attio"])

_WORKSPACE_SLUG = os.environ.get("ATTIO_WORKSPACE_SLUG", "").strip() or "_"


def _attio_company_url(record_id: str) -> str:
    """Best-effort deep link to a Company record in the Attio web app."""
    return f"https://app.attio.com/{_WORKSPACE_SLUG}/objects/companies/record/{record_id}"


@router.post("/send-company/{company_id}")
def send_company(
    company_id: str = Path(..., description="UUID in deep_research.companies"),
):
    """Push one company into Attio. Returns the resulting Attio record_ids."""
    if not attio_is_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "Attio sync is disabled. Set ATTIO_SYNC_ENABLED=true and "
                "ATTIO_API_KEY in the API process environment, then restart."
            ),
        )

    conn = _make_conn()
    conn.autocommit = False
    try:
        cur = conn.cursor()
        try:
            try:
                bundle = load_bundle(cur, company_id=company_id)
            except psycopg2.Error as exc:
                logger.exception("postgres error loading bundle id=%s", company_id)
                raise HTTPException(
                    status_code=500, detail=f"database error: {exc}"
                ) from exc

            if bundle is None:
                raise HTTPException(status_code=404, detail="Company not found")

            result = send_company_to_attio(
                company=bundle.company,
                contacts=bundle.contacts,
                research_summary_markdown=bundle.research_summary_markdown,
            )

            if result.skipped:
                # Defensive — should be unreachable because we checked above.
                raise HTTPException(status_code=503, detail="Attio sync disabled")

            persist_record_ids(cur, company_uuid=bundle.company["id"], result=result)
            conn.commit()

            return {
                "ok": result.ok,
                "company_record_id": result.company_record_id,
                "company_attio_url": (
                    _attio_company_url(result.company_record_id)
                    if result.company_record_id
                    else None
                ),
                "contacts_pushed": len(result.contact_record_ids),
                "contacts_total": len(bundle.contacts),
                "notes_appended": len(result.note_record_ids),
                "errors": result.errors,
            }
        finally:
            cur.close()
    finally:
        conn.close()
