"""
Saved lists API: static company lists for Pipeline.
Scope: private | team | public. Items stored in saved_list_items.
"""
import copy
import logging
import os
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..analysis.stage1_filter import FinancialFilter, filter_criteria_from_dict, humanize_filter_criteria
from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id
from .universe import (
    UniverseQueryPayload,
    _build_order,
    _build_universe_source_subquery,
    _build_where_from_stack,
    _sanitize_filters,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lists", tags=["lists"])

MAX_ORGNR_FROM_QUERY = 50_000


class ListCreate(BaseModel):
    name: str
    scope: str = "private"
    sourceViewId: Optional[str] = None


class ListFromQuery(BaseModel):
    name: str
    scope: str = "private"
    queryPayload: UniverseQueryPayload


class ListFromSourcing(BaseModel):
    """Persist Pipeline list from sourcing-chat FilterCriteria (financial + custom rules)."""

    name: str
    scope: str = "private"
    criteria: dict


class ListItemsAdd(BaseModel):
    orgnrs: List[str]


class ListUpdate(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    sourceViewId: Optional[str] = None
    stage: Optional[str] = None  # research | ai_analysis | prospects


def _owner_email(owner_user_id: str) -> Optional[str]:
    """Look up owner email by user ID. Not configured; returns None."""
    return None


def _require_postgres():
    import os
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "Lists require DATABASE_SOURCE=postgres")


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    # When REQUIRE_AUTH=false or path is public, allow with default dev user
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"  # dev placeholder
    raise HTTPException(401, "Authentication required")


@router.get("")
async def list_lists(request: Request, scope: str = Query("all")):
    """List saved lists: private, team, or all. Returns empty when Postgres unavailable."""
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        return {"items": []}
    uid = _require_user(request)
    try:
        db = get_database_service()
    except Exception as e:
        logger.warning("Lists: get_database_service failed: %s", e)
        return {"items": []}

    if not db.table_exists("saved_lists"):
        return {"items": []}
    if not db.table_exists("saved_list_items"):
        return {"items": []}

    try:
        if scope == "private":
            rows = db.run_raw_query(
                "SELECT * FROM saved_lists WHERE owner_user_id::text = ? ORDER BY updated_at DESC",
                [uid],
            )
        elif scope == "team":
            rows = db.run_raw_query(
                "SELECT * FROM saved_lists WHERE scope = 'team' ORDER BY updated_at DESC"
            )
        elif scope == "public":
            rows = db.run_raw_query(
                "SELECT * FROM saved_lists WHERE scope = 'public' ORDER BY updated_at DESC"
            )
        else:
            rows = db.run_raw_query(
                """
                SELECT * FROM saved_lists
                WHERE scope IN ('team', 'public') OR owner_user_id::text = ?
                ORDER BY updated_at DESC
                """,
                [uid],
            )

        items = []
        for r in rows:
            count = db.run_raw_query(
                "SELECT COUNT(*) as n FROM saved_list_items WHERE list_id::text = ?",
                [str(r["id"])],
            )
            owner_id = str(r["owner_user_id"])
            items.append({
                "id": str(r["id"]),
                "name": r["name"],
                "owner_user_id": owner_id,
                "owner_email": _owner_email(owner_id),
                "scope": r["scope"],
                "source_view_id": str(r["source_view_id"]) if r.get("source_view_id") else None,
                "description": r.get("description"),
                "stage": str(r.get("stage", "research")),
                "created_at": str(r.get("created_at", "")),
                "updated_at": str(r.get("updated_at", "")),
                "item_count": count[0]["n"] if count else 0,
            })

        return {"items": items}
    except Exception as e:
        logger.exception("Lists: query failed: %s", e)
        return {"items": []}


@router.post("")
async def create_list(request: Request, body: ListCreate):
    """Create a new list."""
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team", "public"):
        raise HTTPException(400, "scope must be private, team, or public")

    db = get_database_service()
    source_id = body.sourceViewId if body.sourceViewId else None
    db.run_raw_query(
        "INSERT INTO saved_lists (name, owner_user_id, scope, source_view_id) VALUES (?, ?, ?, ?::uuid)",
        [body.name, uid, body.scope, source_id],
    )
    rows = db.run_raw_query(
        "SELECT * FROM saved_lists WHERE owner_user_id::text = ? ORDER BY created_at DESC LIMIT 1",
        [uid],
    )
    r = rows[0] if rows else {}
    return {
        "id": str(r.get("id", "")),
        "name": r.get("name"),
        "owner_user_id": str(r.get("owner_user_id", "")),
        "scope": r.get("scope"),
        "source_view_id": str(r["source_view_id"]) if r.get("source_view_id") else None,
        "stage": str(r.get("stage", "research")),
        "created_at": str(r.get("created_at", "")),
        "updated_at": str(r.get("updated_at", "")),
    }


@router.post("/from_query")
async def create_list_from_query(request: Request, body: ListFromQuery):
    """
    Create a list from ALL companies matching the current Universe query.
    Server-side: runs the same query as /api/universe/query with LIMIT 50000,
    creates the list, bulk-inserts items. Returns listId, insertedCount, totalMatched.
    """
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team", "public"):
        raise HTTPException(400, "scope must be private, team, or public")

    db = get_database_service()
    if not hasattr(db, "run_execute_values"):
        raise HTTPException(503, "create_list_from_query requires Postgres")

    payload = body.queryPayload
    sanitized_filters = _sanitize_filters(payload.filters or [])
    include_where, include_params = _build_where_from_stack(
        sanitized_filters, getattr(payload, "q", None), db_is_postgres=True
    )
    sanitized_exclude = _sanitize_filters(getattr(payload, "excludeFilters", None) or [])
    if sanitized_exclude:
        exclude_where, exclude_params = _build_where_from_stack(
            sanitized_exclude, None, db_is_postgres=True
        )
        where_sql = f"({include_where}) AND NOT ({exclude_where})"
        params = list(include_params) + list(exclude_params)
    else:
        where_sql = include_where
        params = list(include_params)
    params.append(MAX_ORGNR_FROM_QUERY)
    order_sql = _build_order(payload.sort or {}, db_is_postgres=True)

    source_sql, _, _ = _build_universe_source_subquery(db)
    sql_orgnrs = f"""
    SELECT cm.orgnr
    FROM {source_sql}
    WHERE {where_sql}
    ORDER BY {order_sql}
    LIMIT ?
    """
    rows = db.run_raw_query(sql_orgnrs, params)
    orgnrs = [str(r["orgnr"]) for r in rows if r.get("orgnr")]
    total_matched = len(orgnrs)

    if total_matched >= MAX_ORGNR_FROM_QUERY:
        raise HTTPException(
            400,
            f"Your query matches at least {MAX_ORGNR_FROM_QUERY:,} companies. Add more filters or create a view first.",
        )

    if total_matched == 0:
        raise HTTPException(400, "Your query matches no companies. Adjust filters and try again.")

    db.run_raw_query(
        "INSERT INTO saved_lists (name, owner_user_id, scope) VALUES (?, ?, ?)",
        [body.name, uid, body.scope],
    )
    list_rows = db.run_raw_query(
        "SELECT id FROM saved_lists WHERE owner_user_id::text = ? ORDER BY created_at DESC LIMIT 1",
        [uid],
    )
    list_id = str(list_rows[0]["id"]) if list_rows else ""

    values = [(list_id, o, uid) for o in orgnrs]
    insert_sql = """
    INSERT INTO saved_list_items (list_id, orgnr, added_by_user_id)
    VALUES %s
    ON CONFLICT (list_id, orgnr) DO NOTHING
    """
    inserted = db.run_execute_values(insert_sql, values)

    logger.info("create_list_from_query: list_id=%s inserted=%d total_matched=%d", list_id, inserted, total_matched)

    return {
        "listId": list_id,
        "insertedCount": inserted,
        "totalMatched": total_matched,
    }


@router.post("/from_sourcing")
async def create_list_from_sourcing(request: Request, body: ListFromSourcing):
    """
    Create a Pipeline list from refined sourcing-chat criteria (FilterCriteria).
    Resolves up to 50k orgnrs via the same financial filter as /api/analysis/chat; stores a plain-language why.
    """
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team", "public"):
        raise HTTPException(400, "scope must be private, team, or public")

    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "name cannot be empty")

    db = get_database_service()
    if not hasattr(db, "run_execute_values"):
        raise HTTPException(503, "create_list_from_sourcing requires Postgres")

    fc = filter_criteria_from_dict(body.criteria)
    filter_engine = FinancialFilter()
    stats = filter_engine.get_filter_stats(fc)
    total = int(stats["total_matches"])
    if total >= MAX_ORGNR_FROM_QUERY:
        raise HTTPException(
            400,
            f"This filter matches at least {MAX_ORGNR_FROM_QUERY:,} companies. Refine the chat filters before saving as a list.",
        )
    if total == 0:
        raise HTTPException(400, "No companies match these filters. Adjust criteria and try again.")

    why = humanize_filter_criteria(fc)
    fc_run = copy.copy(fc)
    fc_run.max_results = MAX_ORGNR_FROM_QUERY
    orgnrs = filter_engine.filter(fc_run)
    total_matched = len(orgnrs)
    if total_matched == 0:
        raise HTTPException(400, "No companies to insert. Try again or narrow filters.")

    try:
        db.run_raw_query(
            "INSERT INTO saved_lists (name, owner_user_id, scope, description) VALUES (?, ?, ?, ?)",
            [name, uid, body.scope, why],
        )
    except Exception as e:
        err = str(e).lower()
        if "description" in err or "column" in err:
            db.run_raw_query(
                "INSERT INTO saved_lists (name, owner_user_id, scope) VALUES (?, ?, ?)",
                [name, uid, body.scope],
            )
        else:
            raise

    list_rows = db.run_raw_query(
        "SELECT id FROM saved_lists WHERE owner_user_id::text = ? ORDER BY created_at DESC LIMIT 1",
        [uid],
    )
    list_id = str(list_rows[0]["id"]) if list_rows else ""
    if not list_id:
        raise HTTPException(500, "Failed to create list")

    values = [(list_id, o, uid) for o in orgnrs]
    insert_sql = """
    INSERT INTO saved_list_items (list_id, orgnr, added_by_user_id)
    VALUES %s
    ON CONFLICT (list_id, orgnr) DO NOTHING
    """
    inserted = db.run_execute_values(insert_sql, values)

    logger.info(
        "create_list_from_sourcing: list_id=%s inserted=%d total_matched=%d",
        list_id,
        inserted,
        total_matched,
    )

    return {
        "listId": list_id,
        "insertedCount": inserted,
        "totalMatched": total_matched,
        "whyThisList": why,
    }


@router.post("/{list_id}/items")
async def add_list_items(request: Request, list_id: str, body: ListItemsAdd):
    """Bulk add companies to a list."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT * FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    r = rows[0]
    owner = str(r["owner_user_id"])
    if owner != uid and r.get("scope") != "team":
        raise HTTPException(403, "Not allowed to edit this list")

    added = 0
    for orgnr in (body.orgnrs or []):
        orgnr = str(orgnr).strip()
        if not orgnr:
            continue
        try:
            db.run_raw_query(
                """
                INSERT INTO saved_list_items (list_id, orgnr, added_by_user_id)
                VALUES (?::uuid, ?, ?)
                ON CONFLICT (list_id, orgnr) DO NOTHING
                """,
                [list_id, orgnr, uid],
            )
            added += 1
        except Exception:
            pass  # skip duplicates / invalid
    return {"added": added}


@router.delete("/{list_id}/items/{orgnr}")
async def remove_list_item(request: Request, list_id: str, orgnr: str):
    """Remove a company from a list."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT * FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    r = rows[0]
    owner = str(r["owner_user_id"])
    if owner != uid and r.get("scope") != "team":
        raise HTTPException(403, "Not allowed to edit this list")

    db.run_raw_query(
        "DELETE FROM saved_list_items WHERE list_id::text = ? AND orgnr = ?",
        [list_id, orgnr],
    )
    return {"removed": True}


@router.get("/{list_id}/items")
async def get_list_items(request: Request, list_id: str):
    """Get all companies in a list."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT * FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    r = rows[0]
    owner = str(r["owner_user_id"])
    if owner != uid and r.get("scope") != "team":
        raise HTTPException(403, "Not allowed to view this list")

    items = db.run_raw_query(
        "SELECT orgnr, added_by_user_id, added_at FROM saved_list_items WHERE list_id::text = ? ORDER BY added_at DESC",
        [list_id],
    )
    return {
        "list_id": list_id,
        "items": [{"orgnr": x["orgnr"], "added_by": str(x["added_by_user_id"]), "added_at": str(x["added_at"])} for x in items],
    }


@router.put("/{list_id}")
async def update_list(request: Request, list_id: str, body: ListUpdate):
    """Update a list (owner can rename/scope)."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT * FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    row = rows[0]
    if str(row.get("owner_user_id")) != uid:
        raise HTTPException(403, "Only owner can update")

    updates: List[str] = []
    params: List[Any] = []

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "name cannot be empty")
        updates.append("name = ?")
        params.append(name)

    if body.scope is not None:
        if body.scope not in ("private", "team", "public"):
            raise HTTPException(400, "scope must be private, team, or public")
        updates.append("scope = ?")
        params.append(body.scope)

    if body.sourceViewId is not None:
        updates.append("source_view_id = ?::uuid")
        params.append(body.sourceViewId)

    if body.stage is not None:
        if body.stage not in ("research", "ai_analysis", "prospects"):
            raise HTTPException(400, "stage must be research, ai_analysis, or prospects")
        updates.append("stage = ?")
        params.append(body.stage)

    if not updates:
        return {
            "id": str(row.get("id", "")),
            "name": row.get("name"),
            "owner_user_id": str(row.get("owner_user_id", "")),
            "scope": row.get("scope"),
            "source_view_id": str(row["source_view_id"]) if row.get("source_view_id") else None,
            "stage": str(row.get("stage", "research")),
            "created_at": str(row.get("created_at", "")),
            "updated_at": str(row.get("updated_at", "")),
        }

    updates.append("updated_at = NOW()")
    params.append(list_id)
    db.run_raw_query(
        f"UPDATE saved_lists SET {', '.join(updates)} WHERE id::text = ?",
        params,
    )

    updated = db.run_raw_query("SELECT * FROM saved_lists WHERE id::text = ?", [list_id])[0]
    return {
        "id": str(updated.get("id", "")),
        "name": updated.get("name"),
        "owner_user_id": str(updated.get("owner_user_id", "")),
        "scope": updated.get("scope"),
        "source_view_id": str(updated["source_view_id"]) if updated.get("source_view_id") else None,
        "stage": str(updated.get("stage", "research")),
        "created_at": str(updated.get("created_at", "")),
        "updated_at": str(updated.get("updated_at", "")),
    }


@router.post("/{list_id}/handoff/ai-lab")
async def handoff_to_ai_lab(request: Request, list_id: str):
    """Log handoff intent and return redirect URL for AI Lab create run with this list."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    rows = db.run_raw_query("SELECT id, owner_user_id, scope FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    r = rows[0]
    if str(r["owner_user_id"]) != uid and r.get("scope") != "team":
        raise HTTPException(403, "Not allowed to use this list")
    redirect_url = f"/ai/run/create?list={list_id}"
    logger.info("Handoff to AI Lab: list_id=%s user_id=%s", list_id, uid)
    return {"redirectUrl": redirect_url}


@router.delete("/{list_id}")
async def delete_list(request: Request, list_id: str):
    """Delete a list (owner only)."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()

    rows = db.run_raw_query("SELECT owner_user_id FROM saved_lists WHERE id::text = ?", [list_id])
    if not rows:
        raise HTTPException(404, "List not found")
    if str(rows[0]["owner_user_id"]) != uid:
        raise HTTPException(403, "Only owner can delete")

    db.run_raw_query("DELETE FROM saved_lists WHERE id::text = ?", [list_id])
    return {"deleted": True}
