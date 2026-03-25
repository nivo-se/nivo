"""
Enroll: capture sub + email for any authenticated user on login.
No allowlist or role check — any valid JWT can enroll.
Also used to determine whether the app is bootstrapped (any users have a role).

Email/name: prefer JWT claims (from Auth0) when present; fall back to request body from frontend.
See docs/AUTH_AUTH0_SETUP.md for adding email to the access token via Auth0 Action.

Trusted-domain auto-role: set AUTO_APPROVE_EMAIL_DOMAINS (comma-separated, e.g. nivogroup.se) so
team members get a role without "Claim first admin" or manual SQL when the DB already has admins.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from .dependencies import get_current_user
from .rbac import (
    get_current_sub,
    get_role_for_sub,
    list_user_roles,
    require_allowlist_enabled,
    set_allowed_user,
    upsert_user_role,
)

logger = logging.getLogger(__name__)

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


def _trusted_email_domains() -> set[str]:
    raw = os.getenv("AUTO_APPROVE_EMAIL_DOMAINS", "").strip()
    if not raw:
        return set()
    out: set[str] = set()
    for part in raw.split(","):
        p = part.strip().lower()
        if p.startswith("@"):
            p = p[1:]
        if p:
            out.add(p)
    return out


def _email_domain(email: Optional[str]) -> Optional[str]:
    if not email or "@" not in email:
        return None
    return email.split("@", 1)[1].strip().lower() or None


def _maybe_auto_assign_role_from_domain(sub: str, email: Optional[str]) -> None:
    """
    If user has no role yet and email domain is in AUTO_APPROVE_EMAIL_DOMAINS:
    - First user on an empty user_roles table → admin (+ allowlist if enabled)
    - Otherwise → analyst (+ allowlist if enabled)
    """
    domains = _trusted_email_domains()
    if not domains:
        return
    domain = _email_domain(email)
    if not domain or domain not in domains:
        return
    if get_role_for_sub(sub):
        return
    existing = list_user_roles()
    if not existing:
        upsert_user_role(sub, "admin")
        note = "auto first admin (trusted domain)"
        logger.info("enroll: assigned admin to sub=%s via AUTO_APPROVE_EMAIL_DOMAINS", sub[:20])
    else:
        upsert_user_role(sub, "analyst")
        note = "auto analyst (trusted domain)"
        logger.info("enroll: assigned analyst to sub=%s via AUTO_APPROVE_EMAIL_DOMAINS", sub[:20])
    if require_allowlist_enabled():
        set_allowed_user(sub, True, note)


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
    _maybe_auto_assign_role_from_domain(sub, email)
    role = get_role_for_sub(sub)
    is_bootstrapped = len(list_user_roles()) > 0
    return {
        "sub": sub,
        "email": email,
        "role": role,
        "is_bootstrapped": is_bootstrapped,
    }
