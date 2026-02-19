"""
Company labels API: human judgement (e.g. Hot, Pass) per company.
Scope: private (per user) | team (shared).
"""
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/labels", tags=["labels"])


class LabelCreate(BaseModel):
    label: str
    scope: str = "private"


def _require_postgres():
    import os
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "Labels require DATABASE_SOURCE=postgres")


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"  # dev placeholder
    raise HTTPException(401, "Authentication required")


@router.get("/{orgnr}")
async def get_labels(
    request: Request,
    orgnr: str,
    scope: Optional[str] = Query(None, description="private | team | all"),
):
    """Get labels for a company. scope=all returns both private (for current user) and team."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    if not db.table_exists("company_labels"):
        return {"labels": []}

    if scope == "private":
        rows = db.run_raw_query(
            "SELECT label, scope, created_by_user_id, created_at FROM company_labels WHERE orgnr = ? AND scope = 'private' AND created_by_user_id::text = ?",
            [orgnr, uid],
        )
    elif scope == "team":
        rows = db.run_raw_query(
            "SELECT label, scope, created_by_user_id, created_at FROM company_labels WHERE orgnr = ? AND scope = 'team'",
            [orgnr],
        )
    else:
        rows = db.run_raw_query(
            """
            SELECT label, scope, created_by_user_id, created_at FROM company_labels
            WHERE orgnr = ?
            AND (scope = 'team' OR (scope = 'private' AND created_by_user_id::text = ?))
            """,
            [orgnr, uid],
        )

    return {"labels": [{"label": r["label"], "scope": r["scope"], "created_by": str(r["created_by_user_id"]), "created_at": str(r["created_at"])} for r in rows]}


@router.post("/{orgnr}")
async def add_label(request: Request, orgnr: str, body: LabelCreate):
    """Add a label to a company."""
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team"):
        raise HTTPException(400, "scope must be private or team")

    db = get_database_service()
    try:
        db.run_raw_query(
            """
            INSERT INTO company_labels (orgnr, label, scope, created_by_user_id)
            VALUES (?, ?, ?, ?::uuid)
            ON CONFLICT (orgnr, label, scope, created_by_user_id) DO NOTHING
            """,
            [orgnr, body.label.strip(), body.scope, uid],
        )
    except Exception as e:
        logger.warning("Label insert: %s", e)
    return {"added": True}


@router.delete("/{orgnr}")
async def remove_label(
    request: Request,
    orgnr: str,
    label: str = Query(...),
    scope: str = Query(...),
):
    """Remove a label from a company."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    if scope == "private":
        db.run_raw_query(
            "DELETE FROM company_labels WHERE orgnr = ? AND label = ? AND scope = 'private' AND created_by_user_id::text = ?",
            [orgnr, label, uid],
        )
    else:
        db.run_raw_query(
            "DELETE FROM company_labels WHERE orgnr = ? AND label = ? AND scope = 'team'",
            [orgnr, label],
        )
    return {"removed": True}
