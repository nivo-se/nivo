"""
Saved views API: dynamic filter configs for Universe.
Scope: private (owner only) | team (all authenticated).
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/views", tags=["views"])


class ViewCreate(BaseModel):
    name: str
    scope: str = "private"
    filtersJson: Dict[str, Any] = {}
    columnsJson: List[Any] = []
    sortJson: Dict[str, Any] = {}


class ViewUpdate(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    filtersJson: Optional[Dict[str, Any]] = None
    columnsJson: Optional[List[Any]] = None
    sortJson: Optional[Dict[str, Any]] = None


def _require_postgres():
    import os
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "Views require DATABASE_SOURCE=postgres")


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"  # dev placeholder
    raise HTTPException(401, "Authentication required")


@router.get("")
async def list_views(
    request: Request,
    scope: str = Query("all", description="private | team | all"),
):
    """List views: private (mine), team (shared), or all."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    if not db.table_exists("saved_views"):
        return {"items": []}

    if scope == "private":
        rows = db.run_raw_query(
            "SELECT * FROM saved_views WHERE owner_user_id::text = ? ORDER BY updated_at DESC",
            [uid],
        )
    elif scope == "team":
        rows = db.run_raw_query(
            "SELECT * FROM saved_views WHERE scope = 'team' ORDER BY updated_at DESC"
        )
    else:
        rows = db.run_raw_query(
            """
            SELECT * FROM saved_views
            WHERE scope = 'team' OR owner_user_id::text = ?
            ORDER BY updated_at DESC
            """,
            [uid],
        )

    return {"items": [_row_to_view(r) for r in rows]}


@router.post("")
async def create_view(request: Request, body: ViewCreate):
    """Create a new view."""
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team"):
        raise HTTPException(400, "scope must be private or team")

    db = get_database_service()
    db.run_raw_query(
        """
        INSERT INTO saved_views (name, owner_user_id, scope, filters_json, columns_json, sort_json)
        VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
        """,
        [
            body.name,
            uid,
            body.scope,
            json.dumps(body.filtersJson),
            json.dumps(body.columnsJson),
            json.dumps(body.sortJson),
        ],
    )
    rows = db.run_raw_query(
        "SELECT * FROM saved_views WHERE owner_user_id::text = ? ORDER BY created_at DESC LIMIT 1",
        [uid],
    )
    return _row_to_view(rows[0]) if rows else {}


@router.put("/{view_id}")
async def update_view(request: Request, view_id: str, body: ViewUpdate):
    """Update an existing view (owner or team editable)."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT * FROM saved_views WHERE id::text = ?", [view_id])
    if not rows:
        raise HTTPException(404, "View not found")
    row = rows[0]
    owner = str(row.get("owner_user_id", ""))
    if owner != uid and row.get("scope") != "team":
        raise HTTPException(403, "Not allowed to edit this view")

    updates = []
    params = []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name)
    if body.scope is not None:
        if body.scope not in ("private", "team"):
            raise HTTPException(400, "scope must be private or team")
        updates.append("scope = ?")
        params.append(body.scope)
    if body.filtersJson is not None:
        updates.append("filters_json = ?::jsonb")
        params.append(json.dumps(body.filtersJson))
    if body.columnsJson is not None:
        updates.append("columns_json = ?::jsonb")
        params.append(json.dumps(body.columnsJson))
    if body.sortJson is not None:
        updates.append("sort_json = ?::jsonb")
        params.append(json.dumps(body.sortJson))

    if not updates:
        return _row_to_view(row)

    params.append(view_id)
    db.run_raw_query(
        f"UPDATE saved_views SET {', '.join(updates)} WHERE id::text = ?",
        params,
    )
    rows = db.run_raw_query("SELECT * FROM saved_views WHERE id::text = ?", [view_id])
    return _row_to_view(rows[0]) if rows else _row_to_view(row)


@router.delete("/{view_id}")
async def delete_view(request: Request, view_id: str):
    """Delete a view (owner only)."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT owner_user_id FROM saved_views WHERE id::text = ?", [view_id])
    if not rows:
        raise HTTPException(404, "View not found")
    if str(rows[0]["owner_user_id"]) != uid:
        raise HTTPException(403, "Only owner can delete")

    db.run_raw_query("DELETE FROM saved_views WHERE id::text = ?", [view_id])
    return {"deleted": True}


def _row_to_view(r: Dict) -> Dict:
    return {
        "id": str(r.get("id", "")),
        "name": r.get("name"),
        "owner_user_id": str(r.get("owner_user_id", "")),
        "scope": r.get("scope"),
        "filtersJson": r.get("filters_json") or {},
        "columnsJson": r.get("columns_json") or [],
        "sortJson": r.get("sort_json") or {},
        "created_at": str(r.get("created_at", "")),
        "updated_at": str(r.get("updated_at", "")),
    }
