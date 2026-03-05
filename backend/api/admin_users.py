"""
Admin API: create users and set privileges.
Uses JWT + allowlist (ADMIN_EMAILS) for admin check. User create/update return 503 when not configured.
"""
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Admin emails that can create users (bypass user_roles lookup when DB not available)
ADMIN_EMAILS = {"jesper@rgcapital.se"}

UserRole = Literal["pending", "approved", "admin"]


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = "approved"
    first_name: str | None = None
    last_name: str | None = None


class CreateUserResponse(BaseModel):
    user_id: str
    email: str
    role: str
    message: str


class UpdateUserProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None


async def _require_admin(request: Request) -> str:
    """Verify requester is admin. Returns user_id or raises 403."""
    user_id = get_current_user_id(request)
    # When REQUIRE_AUTH=false, middleware may not set user - try to verify token for this route
    if not user_id:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            from .auth import _verify_token
            payload = _verify_token(auth[7:].strip())
            if payload:
                request.state.user = {"sub": payload.get("sub"), "email": payload.get("email")}
                user_id = str(payload.get("sub", ""))
    if not user_id:
        raise HTTPException(403, "Authentication required")
    user = getattr(request.state, "user", None)
    email = (user or {}).get("email")
    if email and email in ADMIN_EMAILS:
        return user_id
    raise HTTPException(403, "Admin privileges required")


@router.post("/users", response_model=CreateUserResponse)
async def create_user(
    body: CreateUserRequest,
    request: Request,
    _: str = Depends(_require_admin),
):
    """
    Create a new user with email, password, and role.
    Admin only. User management not configured (no auth backend); returns 503.
    """
    raise HTTPException(503, "User creation not configured. Use your auth provider to manage users.")


@router.patch("/users/{user_id}", response_model=dict)
async def update_user_profile(
    user_id: str,
    body: UpdateUserProfileRequest,
    request: Request,
    _: str = Depends(_require_admin),
):
    """
    Update a user's first_name and last_name.
    Admin only. User management not configured; returns 503.
    """
    raise HTTPException(503, "User profile update not configured.")
