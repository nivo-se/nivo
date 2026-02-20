"""
Admin API: role and allowlist management. Local Postgres only (user_roles, allowed_users).
All endpoints require role=admin via require_role("admin").
"""
import logging
from typing import List, Optional

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


@router.get("/users")
def list_users(_sub: str = Depends(require_role("admin"))):
    """
    List all user_roles and allowed_users. Admin only.
    Returns { "user_roles": [...], "allowed_users": [...] }.
    """
    roles = list_user_roles()
    allowed = list_allowed_users()
    # Serialize datetimes for JSON
    def row_to_json(r):
        d = dict(r)
        for k in ("created_at", "updated_at"):
            if k in d and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        return d
    return {
        "user_roles": [row_to_json(r) for r in roles],
        "allowed_users": [row_to_json(a) for a in allowed],
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
