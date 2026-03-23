"""
Screening profiles API: CRUD for Layer 1 screening profiles and versions.
Profiles hold versioned config (variables, weights, archetypes, exclusion_rules).
"""
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .universe import validate_proposed_filters
from ..services.db_factory import get_database_service
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screening", tags=["screening"])


@router.get("/context")
async def get_screening_context(request: Request):
    """Effective user id for screening APIs (JWT sub, or dev user when REQUIRE_AUTH=false)."""
    _require_postgres()
    uid = _require_user(request)
    return {"userId": uid}


@router.get("/exemplar-chunks")
async def get_exemplar_chunks(
    request: Request,
    orgnr: str = Query(..., min_length=6, description="Swedish org number linked in exemplar_reports_manifest.json"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Optional RAG source: rows in ``ai_ops.exemplar_report_chunks`` (orgnr + analysis_run_id).

    Apply migration ``042_exemplar_report_chunks.sql``, then
    ``python3 scripts/index_exemplar_markdown.py --postgres`` (optional ``--pgvector``).
    """
    _require_postgres()
    _require_user(request)
    from ..services.db_factory import get_database_service
    from ..services.screening_orchestrator.exemplar_chunks import (
        exemplar_report_chunks_table_exists,
        list_chunks_for_orgnr,
    )

    db = get_database_service()
    if not exemplar_report_chunks_table_exists(db):
        raise HTTPException(
            503,
            "ai_ops.exemplar_report_chunks not found; run migrations and scripts/index_exemplar_markdown.py --postgres.",
        )
    rows = list_chunks_for_orgnr(db, orgnr.strip(), limit=limit)
    return {"orgnr": orgnr.strip(), "count": len(rows), "chunks": rows}


@router.get("/exemplar-mandate")
async def get_exemplar_mandate(request: Request):
    """
    Metadata for `docs/deep_research/screening_exemplars/screening_output.json` (patterns, archetypes, playbook).
    Does not require Postgres; used to align prompts with a versioned mandate file.
    """
    _require_user(request)
    from ..services.exemplar_mandate import (
        exemplar_mandate_path,
        exemplar_mandate_version,
        load_screening_exemplar_mandate,
    )

    data = load_screening_exemplar_mandate()
    meta = data.get("_meta") if isinstance(data.get("_meta"), dict) else {}
    return {
        "path": str(exemplar_mandate_path()),
        "version": exemplar_mandate_version(data),
        "meta": meta,
        "keys": [k for k in data.keys() if k != "_meta"],
    }


class ValidateFiltersBody(BaseModel):
    """Proposed universe FilterItem rows (Phase B: LLM → validator → human approve)."""

    filters: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/validate-filters")
async def post_validate_filters(request: Request, body: ValidateFiltersBody):
    """
    Validate structured filter rules against universe FILTER_FIELDS / ops.
    Does not execute SQL; returns sanitized filters + per-index errors.
    """
    _require_user(request)
    return validate_proposed_filters(body.filters)


def _require_postgres():
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(503, "Screening profiles require DATABASE_SOURCE=postgres")


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"
    raise HTTPException(401, "Authentication required")


def _ensure_tables(db):
    if not getattr(db, "table_exists", lambda _: False)("screening_profiles"):
        return False
    if not db.table_exists("screening_profile_versions"):
        return False
    return True


def _row_to_profile(r: Dict[str, Any], active_version: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out = {
        "id": str(r["id"]),
        "name": r.get("name"),
        "description": r.get("description"),
        "scope": r.get("scope", "private"),
        "ownerUserId": str(r.get("owner_user_id", "")) if r.get("owner_user_id") is not None else "",
        "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
        "updatedAt": r.get("updated_at").isoformat() if r.get("updated_at") else None,
    }
    if active_version:
        out["activeVersionId"] = str(active_version["id"])
        out["activeVersion"] = active_version.get("version")
        out["activeConfig"] = active_version.get("config_json")
    else:
        out["activeVersionId"] = None
        out["activeVersion"] = None
        out["activeConfig"] = None
    return out


class ProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    scope: str = "private"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    scope: Optional[str] = None


class VersionCreate(BaseModel):
    config: Dict[str, Any]


@router.get("/profiles")
async def list_profiles(
    request: Request,
    scope: str = Query("all", description="private | team | all"),
):
    """List screening profiles. private = mine, team = shared, all = both."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        return {"items": []}

    if scope == "private":
        rows = db.run_raw_query(
            "SELECT * FROM screening_profiles WHERE owner_user_id = ? ORDER BY updated_at DESC",
            [uid],
        )
    elif scope == "team":
        rows = db.run_raw_query(
            "SELECT * FROM screening_profiles WHERE scope = 'team' ORDER BY updated_at DESC"
        )
    else:
        rows = db.run_raw_query(
            "SELECT * FROM screening_profiles WHERE scope = 'team' OR owner_user_id = ? ORDER BY updated_at DESC",
            [uid],
        )

    items = []
    for r in rows:
        pid = str(r["id"])
        active = db.run_raw_query(
            "SELECT id, version, config_json FROM screening_profile_versions WHERE profile_id::text = ? AND is_active = true LIMIT 1",
            [pid],
        )
        active_version = active[0] if active else None
        items.append(_row_to_profile(r, active_version))
    return {"items": items}


@router.post("/profiles")
async def create_profile(request: Request, body: ProfileCreate):
    """Create a new screening profile."""
    _require_postgres()
    uid = _require_user(request)
    if body.scope not in ("private", "team"):
        raise HTTPException(400, "scope must be private or team")
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(503, "Screening profile tables not available")
    db.run_raw_query(
        "INSERT INTO screening_profiles (name, description, owner_user_id, scope) VALUES (?, ?, ?, ?)",
        [body.name, body.description or "", uid, body.scope],
    )
    rows = db.run_raw_query(
        "SELECT * FROM screening_profiles WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 1",
        [uid],
    )
    if not rows:
        raise HTTPException(500, "Failed to create profile")
    return _row_to_profile(rows[0])


@router.get("/profiles/{profile_id}")
async def get_profile(request: Request, profile_id: str):
    """Get profile by id and its active version config."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(404, "Profile not found")
    rows = db.run_raw_query("SELECT * FROM screening_profiles WHERE id::text = ?", [profile_id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    r = rows[0]
    active = db.run_raw_query(
        "SELECT id, version, config_json FROM screening_profile_versions WHERE profile_id::text = ? AND is_active = true LIMIT 1",
        [profile_id],
    )
    active_version = active[0] if active else None
    return _row_to_profile(r, active_version)


@router.put("/profiles/{profile_id}")
async def update_profile(request: Request, profile_id: str, body: ProfileUpdate):
    """Update profile metadata."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(404, "Profile not found")
    rows = db.run_raw_query("SELECT * FROM screening_profiles WHERE id::text = ?", [profile_id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    if str(rows[0].get("owner_user_id")) != uid:
        raise HTTPException(403, "Not allowed to update this profile")
    if body.scope is not None and body.scope not in ("private", "team"):
        raise HTTPException(400, "scope must be private or team")
    updates = []
    params = []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name)
    if body.description is not None:
        updates.append("description = ?")
        params.append(body.description)
    if body.scope is not None:
        updates.append("scope = ?")
        params.append(body.scope)
    if not updates:
        return _row_to_profile(rows[0])
    params.append(profile_id)
    db.run_raw_query(
        f"UPDATE screening_profiles SET {', '.join(updates)} WHERE id::text = ?",
        params,
    )
    rows = db.run_raw_query("SELECT * FROM screening_profiles WHERE id::text = ?", [profile_id])
    return _row_to_profile(rows[0])


@router.delete("/profiles/{profile_id}")
async def delete_profile(request: Request, profile_id: str):
    """Delete profile and all its versions."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(404, "Profile not found")
    rows = db.run_raw_query("SELECT owner_user_id FROM screening_profiles WHERE id::text = ?", [profile_id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    if str(rows[0].get("owner_user_id")) != uid:
        raise HTTPException(403, "Not allowed to delete this profile")
    db.run_raw_query("DELETE FROM screening_profiles WHERE id::text = ?", [profile_id])
    return {"ok": True}


@router.post("/profiles/{profile_id}/versions")
async def create_version(request: Request, profile_id: str, body: VersionCreate):
    """Create a new version for a profile. Does not activate it."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(404, "Profile not found")
    rows = db.run_raw_query("SELECT * FROM screening_profiles WHERE id::text = ?", [profile_id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    if str(rows[0].get("owner_user_id")) != uid:
        raise HTTPException(403, "Not allowed to add version to this profile")
    next_version = 1
    ver_rows = db.run_raw_query(
        "SELECT MAX(version) AS v FROM screening_profile_versions WHERE profile_id::text = ?",
        [profile_id],
    )
    if ver_rows and ver_rows[0].get("v") is not None:
        next_version = int(ver_rows[0]["v"]) + 1
    import json
    config_str = json.dumps(body.config) if isinstance(body.config, dict) else "{}"
    db.run_raw_query(
        "INSERT INTO screening_profile_versions (profile_id, version, config_json, is_active, created_by_user_id) VALUES (?::uuid, ?, ?::jsonb, false, ?)",
        [profile_id, next_version, config_str, uid],
    )
    ver_rows = db.run_raw_query(
        "SELECT id, version, config_json FROM screening_profile_versions WHERE profile_id::text = ? ORDER BY version DESC LIMIT 1",
        [profile_id],
    )
    if not ver_rows:
        raise HTTPException(500, "Failed to create version")
    v = ver_rows[0]
    return {"id": str(v["id"]), "version": v["version"], "config": v.get("config_json"), "isActive": False}


@router.put("/profiles/{profile_id}/versions/{version_id}/activate")
async def activate_version(request: Request, profile_id: str, version_id: str):
    """Set this version as the active one for the profile (deactivates others)."""
    _require_postgres()
    uid = _require_user(request)
    db = get_database_service()
    if not _ensure_tables(db):
        raise HTTPException(404, "Profile not found")
    rows = db.run_raw_query("SELECT owner_user_id FROM screening_profiles WHERE id::text = ?", [profile_id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    if str(rows[0].get("owner_user_id")) != uid:
        raise HTTPException(403, "Not allowed to update this profile")
    db.run_raw_query(
        "UPDATE screening_profile_versions SET is_active = false WHERE profile_id::text = ?",
        [profile_id],
    )
    db.run_raw_query(
        "UPDATE screening_profile_versions SET is_active = true WHERE id::text = ? AND profile_id::text = ?",
        [version_id, profile_id],
    )
    ver_rows = db.run_raw_query(
        "SELECT id, version, config_json FROM screening_profile_versions WHERE id::text = ?",
        [version_id],
    )
    if not ver_rows:
        raise HTTPException(404, "Version not found")
    v = ver_rows[0]
    return {"id": str(v["id"]), "version": v["version"], "config": v.get("config_json"), "isActive": True}
