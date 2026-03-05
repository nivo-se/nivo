"""
RBAC: roles and allowlist keyed by Auth0 sub. Source of truth: local Postgres (user_roles, allowed_users).
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import Depends, HTTPException, Request

from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

# Role hierarchy: admin (2) > analyst (1). Used for 403 and dependency checks.
ROLE_ORDER = ("analyst", "admin")
ROLE_LEVELS = {"analyst": 1, "admin": 2}


def _require_postgres_for_rbac() -> None:
    """Raise 503 if DATABASE_SOURCE is not postgres (roles live in local Postgres only)."""
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(
            503,
            "Roles require DATABASE_SOURCE=postgres. user_roles and allowed_users are in local Postgres.",
        )


def _get_db():
    """Lazy import to avoid circular import at module load."""
    from ..services.db_factory import get_database_service
    return get_database_service()


def _role_level(role: str) -> int:
    """Higher number = more privileged. admin=2, analyst=1, unknown=0."""
    return ROLE_LEVELS.get(role, 0)


def get_role_for_sub(sub: str) -> Optional[str]:
    """Return role for sub from user_roles, or None if not found."""
    _require_postgres_for_rbac()
    db = _get_db()
    try:
        rows = db.run_raw_query("SELECT role FROM user_roles WHERE sub = %s", [sub])
        return rows[0]["role"] if rows else None
    except Exception as e:
        logger.warning("get_role_for_sub failed: %s", e)
        return None


def is_allowed_sub(sub: str) -> bool:
    """True if sub exists in allowed_users and enabled=true."""
    db = _get_db()
    try:
        rows = db.run_raw_query(
            "SELECT 1 FROM allowed_users WHERE sub = %s AND enabled = true",
            [sub],
        )
        return len(rows) > 0
    except Exception as e:
        logger.warning("is_allowed_sub failed: %s", e)
        return False


def require_allowlist_enabled() -> bool:
    return os.getenv("REQUIRE_ALLOWLIST", "false").lower() in ("true", "1", "yes")


def get_current_sub(request: Request) -> str:
    """
    FastAPI dependency: return current user's sub or raise 401.
    Use after JWTAuthMiddleware (so request.state.user is set for protected routes).
    """
    sub = get_current_user_id(request)
    if not sub:
        raise HTTPException(401, "Authentication required")
    return sub


def require_role(required: str):
    """
    FastAPI dependency factory: require that the current user has at least the given role.
    Order: (1) JWT already verified by middleware, (2) sub from get_current_sub,
    (3) if REQUIRE_ALLOWLIST=true check allowed_users (admins do not bypass allowlist),
    (4) then check user_roles. admin=2, analyst=1; returns 403 with clear message if missing or insufficient.
    """

    def _dep(request: Request, sub: str = Depends(get_current_sub)) -> str:
        _require_postgres_for_rbac()
        if require_allowlist_enabled() and not is_allowed_sub(sub):
            raise HTTPException(403, "Not on allowlist")
        role = get_role_for_sub(sub)
        if not role:
            raise HTTPException(403, "No role assigned")
        required_level = ROLE_LEVELS.get(required, 0)
        user_level = _role_level(role)
        if required_level and user_level < required_level:
            raise HTTPException(403, f"Insufficient role: this endpoint requires '{required}' or higher")
        return sub

    return _dep


def require_auth_and_allowlist(request: Request, sub: str = Depends(get_current_sub)) -> str:
    """
    FastAPI dependency: (1) JWT verified by middleware, (2) sub from get_current_sub,
    (3) if REQUIRE_ALLOWLIST=true, require sub in allowed_users with enabled=true (admins do not bypass).
    Returns sub.
    """
    if require_allowlist_enabled() and not is_allowed_sub(sub):
        raise HTTPException(403, "Not on allowlist")
    return sub


def list_user_roles() -> List[dict]:
    """Return all rows from user_roles (for admin list)."""
    _require_postgres_for_rbac()
    db = _get_db()
    return db.run_raw_query(
        "SELECT sub, role, created_at, updated_at FROM user_roles ORDER BY updated_at DESC"
    )


def list_allowed_users() -> List[dict]:
    """Return all rows from allowed_users."""
    _require_postgres_for_rbac()
    db = _get_db()
    return db.run_raw_query(
        "SELECT sub, enabled, note, created_at, updated_at FROM allowed_users ORDER BY updated_at DESC"
    )


def upsert_user_role(sub: str, role: str) -> None:
    """Set role for sub (admin or analyst). Idempotent."""
    _require_postgres_for_rbac()
    if role not in ("admin", "analyst"):
        raise ValueError("role must be admin or analyst")
    db = _get_db()
    db.run_raw_query(
        """
        INSERT INTO user_roles (sub, role) VALUES (%s, %s)
        ON CONFLICT (sub) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
        """,
        [sub, role],
    )


def set_allowed_user(sub: str, enabled: bool, note: Optional[str] = None) -> None:
    """Insert or update allowed_users for sub."""
    _require_postgres_for_rbac()
    db = _get_db()
    db.run_raw_query(
        """
        INSERT INTO allowed_users (sub, enabled, note) VALUES (%s, %s, %s)
        ON CONFLICT (sub) DO UPDATE SET enabled = EXCLUDED.enabled, note = EXCLUDED.note, updated_at = now()
        """,
        [sub, enabled, note],
    )
