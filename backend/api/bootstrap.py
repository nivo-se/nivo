"""
Bootstrap: allow the first authenticated user to claim admin. No allowlist check so they can register before any user exists.
"""
from fastapi import APIRouter, Depends, HTTPException

from .rbac import (
    get_current_sub,
    list_user_roles,
    require_allowlist_enabled,
    set_allowed_user,
    upsert_user_role,
)

router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.post("/bootstrap")
def bootstrap_first_admin(sub: str = Depends(get_current_sub)):
    """
    If no user has a role yet, assign the current user (JWT sub) as admin.
    When REQUIRE_ALLOWLIST=true, also add them to allowed_users.
    Requires valid Auth0 JWT; does not require allowlist (so first user can bootstrap).
    """
    existing = list_user_roles()
    if existing:
        raise HTTPException(403, "Bootstrap already done: at least one user has a role")
    upsert_user_role(sub, "admin")
    if require_allowlist_enabled():
        set_allowed_user(sub, True, "First admin")
    return {"sub": sub, "role": "admin"}
