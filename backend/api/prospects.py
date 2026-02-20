"""Prospects API endpoints."""

from __future__ import annotations

import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from .lists import _require_user

router = APIRouter(prefix="/api/prospects", tags=["prospects"])

VALID_STATUSES = {
    "new",
    "researching",
    "contacted",
    "in_discussion",
    "meeting_scheduled",
    "interested",
    "not_interested",
    "passed",
    "deal_in_progress",
}


class ProspectCreate(BaseModel):
    company_id: str
    status: str = "new"
    scope: str = "team"


class ProspectUpdate(BaseModel):
    status: Optional[str] = None
    owner: Optional[str] = None
    last_contact: Optional[str] = None
    next_action: Optional[str] = None


class ProspectNoteCreate(BaseModel):
    text: str = Field(min_length=1)
    author: Optional[str] = None


class ProspectNoteUpdate(BaseModel):
    text: str = Field(min_length=1)


def _require_postgres() -> None:
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "Prospects require DATABASE_SOURCE=postgres")


def _ensure_tables(db: Any) -> None:
    db.run_raw_query(
        """
        CREATE TABLE IF NOT EXISTS prospects (
            id uuid PRIMARY KEY,
            company_id text NOT NULL,
            owner_user_id text NOT NULL,
            scope text NOT NULL DEFAULT 'team',
            status text NOT NULL DEFAULT 'new',
            owner text,
            last_contact timestamptz,
            next_action text,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW(),
            UNIQUE (company_id, owner_user_id, scope)
        )
        """
    )
    db.run_raw_query(
        """
        CREATE TABLE IF NOT EXISTS prospect_notes (
            id uuid PRIMARY KEY,
            prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
            note_text text NOT NULL,
            author text,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        )
        """
    )


def _to_prospect_response(row: Dict[str, Any], notes: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "companyId": str(row.get("company_id", "")),
        "status": str(row.get("status", "new")),
        "owner": row.get("owner"),
        "lastContact": str(row["last_contact"]) if row.get("last_contact") else None,
        "nextAction": row.get("next_action"),
        "notes": [
            {
                "id": str(n.get("id", "")),
                "text": str(n.get("note_text", "")),
                "author": str(n.get("author", "")) if n.get("author") else "",
                "date": str(n.get("created_at", "")),
            }
            for n in notes
        ],
    }


@router.get("")
async def list_prospects(
    request: Request,
    scope: str = Query("team"),
    status: Optional[str] = Query(None),
):
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    _ensure_tables(db)

    query = "SELECT * FROM prospects WHERE owner_user_id::text = ? AND scope = ?"
    params: List[Any] = [uid, scope]
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY updated_at DESC"

    rows = db.run_raw_query(query, params)
    items = []
    for row in rows:
        notes = db.run_raw_query(
            "SELECT * FROM prospect_notes WHERE prospect_id::text = ? ORDER BY created_at DESC",
            [str(row["id"])],
        )
        items.append(_to_prospect_response(row, notes))
    return {"items": items, "count": len(items), "total": len(items)}


@router.post("")
async def create_prospect(request: Request, body: ProspectCreate):
    _require_postgres()
    uid = _require_user(request)
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, "Invalid prospect status")
    if body.scope not in ("private", "team"):
        raise HTTPException(400, "scope must be private or team")

    db = get_database_service()
    _ensure_tables(db)

    prospect_id = str(uuid.uuid4())
    db.run_raw_query(
        """
        INSERT INTO prospects (id, company_id, owner_user_id, scope, status)
        VALUES (?::uuid, ?, ?, ?, ?)
        ON CONFLICT (company_id, owner_user_id, scope)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
        """,
        [prospect_id, body.company_id, uid, body.scope, body.status],
    )
    row = db.run_raw_query(
        "SELECT * FROM prospects WHERE company_id = ? AND owner_user_id::text = ? AND scope = ? LIMIT 1",
        [body.company_id, uid, body.scope],
    )
    if not row:
        raise HTTPException(500, "Failed to create prospect")
    return _to_prospect_response(row[0], [])


@router.patch("/{company_id}")
async def update_prospect(request: Request, company_id: str, body: ProspectUpdate):
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    _ensure_tables(db)

    rows = db.run_raw_query(
        "SELECT * FROM prospects WHERE company_id = ? AND owner_user_id::text = ? LIMIT 1",
        [company_id, uid],
    )
    if not rows:
        raise HTTPException(404, "Prospect not found")
    existing = rows[0]

    next_status = body.status if body.status is not None else existing.get("status")
    if next_status not in VALID_STATUSES:
        raise HTTPException(400, "Invalid prospect status")

    db.run_raw_query(
        """
        UPDATE prospects
        SET status = ?, owner = ?, last_contact = ?::timestamptz, next_action = ?, updated_at = NOW()
        WHERE id::text = ?
        """,
        [next_status, body.owner, body.last_contact, body.next_action, str(existing["id"])],
    )
    row = db.run_raw_query("SELECT * FROM prospects WHERE id::text = ?", [str(existing["id"])])[0]
    notes = db.run_raw_query(
        "SELECT * FROM prospect_notes WHERE prospect_id::text = ? ORDER BY created_at DESC",
        [str(existing["id"])],
    )
    return _to_prospect_response(row, notes)


@router.post("/{company_id}/notes")
async def add_prospect_note(request: Request, company_id: str, body: ProspectNoteCreate):
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    _ensure_tables(db)

    rows = db.run_raw_query(
        "SELECT * FROM prospects WHERE company_id = ? AND owner_user_id::text = ? LIMIT 1",
        [company_id, uid],
    )
    if not rows:
        raise HTTPException(404, "Prospect not found")

    note_id = str(uuid.uuid4())
    db.run_raw_query(
        "INSERT INTO prospect_notes (id, prospect_id, note_text, author) VALUES (?::uuid, ?::uuid, ?, ?)",
        [note_id, str(rows[0]["id"]), body.text, body.author],
    )
    note = db.run_raw_query("SELECT * FROM prospect_notes WHERE id::text = ?", [note_id])[0]
    return {
        "id": str(note["id"]),
        "text": str(note["note_text"]),
        "author": str(note.get("author", "")) if note.get("author") else "",
        "date": str(note["created_at"]),
    }


@router.patch("/{company_id}/notes/{note_id}")
async def update_prospect_note(request: Request, company_id: str, note_id: str, body: ProspectNoteUpdate):
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    _ensure_tables(db)

    rows = db.run_raw_query(
        """
        SELECT n.*
        FROM prospect_notes n
        JOIN prospects p ON p.id = n.prospect_id
        WHERE p.company_id = ? AND p.owner_user_id::text = ? AND n.id::text = ?
        LIMIT 1
        """,
        [company_id, uid, note_id],
    )
    if not rows:
        raise HTTPException(404, "Note not found")

    db.run_raw_query(
        "UPDATE prospect_notes SET note_text = ?, updated_at = NOW() WHERE id::text = ?",
        [body.text, note_id],
    )
    note = db.run_raw_query("SELECT * FROM prospect_notes WHERE id::text = ?", [note_id])[0]
    return {
        "id": str(note["id"]),
        "text": str(note["note_text"]),
        "author": str(note.get("author", "")) if note.get("author") else "",
        "date": str(note["created_at"]),
    }


@router.delete("/{company_id}/notes/{note_id}")
async def delete_prospect_note(request: Request, company_id: str, note_id: str):
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    _ensure_tables(db)

    db.run_raw_query(
        """
        DELETE FROM prospect_notes n
        USING prospects p
        WHERE n.id::text = ?
          AND p.id = n.prospect_id
          AND p.company_id = ?
          AND p.owner_user_id::text = ?
        """,
        [note_id, company_id, uid],
    )
    return {"success": True}
