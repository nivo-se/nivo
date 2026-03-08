"""
Admin API: role and allowlist management. Local Postgres only (user_roles, allowed_users).
All endpoints require role=admin via require_role("admin").
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .rbac import (
    list_allowed_users,
    list_user_roles,
    require_role,
    set_allowed_user,
    upsert_user_role,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class PutRoleBody(BaseModel):
    role: str  # 'admin' | 'analyst'


class PutAllowBody(BaseModel):
    enabled: bool
    note: Optional[str] = None


def _get_db():
    from ..services.db_factory import get_database_service
    return get_database_service()


def _list_user_profiles() -> list:
    """Return all rows from user_profiles."""
    try:
        db = _get_db()
        return db.run_raw_query(
            "SELECT sub, email, name, first_seen, last_seen FROM user_profiles ORDER BY last_seen DESC"
        )
    except Exception:
        return []


@router.get("/users")
def list_users(_sub: str = Depends(require_role("admin"))):
    """
    List all user_roles, allowed_users, and pending_users (profiles with no role). Admin only.
    Returns { "user_roles": [...], "allowed_users": [...], "pending_users": [...] }.
    """
    roles = list_user_roles()
    allowed = list_allowed_users()
    profiles = _list_user_profiles()

    # Build lookup: sub → profile (email, name)
    profile_by_sub = {p["sub"]: p for p in profiles}
    role_subs = {r["sub"] for r in roles}

    def row_to_json(r):
        d = dict(r)
        for k in ("created_at", "updated_at", "first_seen", "last_seen"):
            if k in d and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        return d

    # Enrich user_roles rows with email/name from profiles
    enriched_roles = []
    for r in roles:
        row = row_to_json(r)
        profile = profile_by_sub.get(r["sub"])
        row["email"] = profile["email"] if profile else None
        row["name"] = profile["name"] if profile else None
        enriched_roles.append(row)

    # pending_users: profiles whose sub has no entry in user_roles
    pending = [
        row_to_json(p)
        for p in profiles
        if p["sub"] not in role_subs
    ]

    return {
        "user_roles": enriched_roles,
        "allowed_users": [row_to_json(a) for a in allowed],
        "pending_users": pending,
    }


@router.put("/users/{sub}/role")
def set_user_role(
    sub: str,
    body: PutRoleBody,
    _admin_sub: str = Depends(require_role("admin")),
):
    """Set role for user by Auth0 sub. Admin only. Idempotent upsert."""
    if body.role not in ("admin", "analyst"):
        raise HTTPException(400, "role must be 'admin' or 'analyst'")
    upsert_user_role(sub, body.role)
    return {"sub": sub, "role": body.role}


@router.put("/users/{sub}/allow")
def set_user_allow(
    sub: str,
    body: PutAllowBody,
    _admin_sub: str = Depends(require_role("admin")),
):
    """Set allowlist entry for sub. Admin only."""
    set_allowed_user(sub, body.enabled, body.note)
    return {"sub": sub, "enabled": body.enabled, "note": body.note}
