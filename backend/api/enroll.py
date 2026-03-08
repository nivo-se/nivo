"""
Enroll: capture sub + email for any authenticated user on login.
No allowlist or role check — any valid JWT can enroll.
Also used to determine whether the app is bootstrapped (any users have a role).

Email/name: prefer JWT claims (from Auth0) when present; fall back to request body from frontend.
See docs/AUTH_AUTH0_SETUP.md for adding email to the access token via Auth0 Action.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from .dependencies import get_current_user
from .rbac import get_current_sub, get_role_for_sub, list_user_roles

router = APIRouter(prefix="/api", tags=["enroll"])


def _get_db():
    from ..services.db_factory import get_database_service
    return get_database_service()


def upsert_user_profile(sub: str, email: Optional[str], name: Optional[str]) -> None:
    """Upsert sub + email + name into user_profiles, refreshing last_seen."""
    db = _get_db()
    db.run_raw_query(
        """
        INSERT INTO user_profiles (sub, email, name)
        VALUES (%s, %s, %s)
        ON CONFLICT (sub) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, user_profiles.email),
              name  = COALESCE(EXCLUDED.name,  user_profiles.name),
              last_seen = now()
        """,
        [sub, email or None, name or None],
    )


class EnrollRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None


@router.post("/enroll")
def enroll(
    body: EnrollRequest,
    request: Request,
    sub: str = Depends(get_current_sub),
):
    """
    Register the current user's email in user_profiles and return their role + bootstrap status.
    Called on every login by the frontend. Requires valid JWT; no role or allowlist check.

    Email/name: prefer JWT claims (Auth0) when present; otherwise use body from frontend.
    """
    user = get_current_user(request)
    # Prefer email/name from JWT (Auth0) when present; fall back to body from frontend
    email = (user.get("email") if user else None) or body.email
    name = (user.get("name") if user else None) or body.name
    upsert_user_profile(sub, email, name)
    role = get_role_for_sub(sub)
    is_bootstrapped = len(list_user_roles()) > 0
    return {
        "sub": sub,
        "email": email,
        "role": role,
        "is_bootstrapped": is_bootstrapped,
    }
