"""
Current user endpoint: GET /api/me. Requires auth; optional allowlist when REQUIRE_ALLOWLIST=true.
"""
from fastapi import APIRouter, Depends

from .rbac import get_role_for_sub, require_auth_and_allowlist

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me")
def get_me(sub: str = Depends(require_auth_and_allowlist)):
    """
    Return current user identity and role from local Postgres.
    Requires valid JWT; if REQUIRE_ALLOWLIST=true, sub must be in allowed_users with enabled=true.
    """
    role = get_role_for_sub(sub)
    return {
        "sub": sub,
        "role": role,
    }
