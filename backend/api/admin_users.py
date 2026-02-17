"""
Admin API: create users and set privileges.
Requires Supabase Auth Admin (service role) and user_roles table.
"""
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from .dependencies import get_supabase_admin_client, get_current_user_id

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
    # When REQUIRE_AUTH is false, request.state.user may be None - allow for dev
    user = getattr(request.state, "user", None)
    email = (user or {}).get("email")
    if email and email in ADMIN_EMAILS:
        return user_id
    # Check user_roles for admin
    supabase = get_supabase_admin_client()
    if supabase:
        try:
            r = (
                supabase.table("user_roles")
                .select("role")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if r.data and (r.data.get("role") or "").lower() == "admin":
                return user_id
        except Exception as e:
            logger.warning("Could not check user_roles: %s", e)
    raise HTTPException(403, "Admin privileges required")


@router.post("/users", response_model=CreateUserResponse)
async def create_user(
    body: CreateUserRequest,
    request: Request,
    _: str = Depends(_require_admin),
):
    """
    Create a new user with email, password, and role.
    Admin only. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
    """
    supabase = get_supabase_admin_client()
    if not supabase:
        raise HTTPException(
            503,
            "User creation not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    # Validate password
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    try:
        # Build user metadata for auth and profile
        user_metadata = {}
        if body.first_name:
            user_metadata["first_name"] = body.first_name
        if body.last_name:
            user_metadata["last_name"] = body.last_name

        # Create user in Supabase Auth
        create_options: dict = {
            "email": body.email,
            "password": body.password,
            "email_confirm": True,  # Skip email confirmation
        }
        if user_metadata:
            create_options["data"] = user_metadata

        resp = supabase.auth.admin.create_user(create_options)

        if not resp or not resp.user:
            raise HTTPException(500, "Failed to create user in Auth")

        user_id = str(resp.user.id)

        # Insert into user_roles
        admin_id = get_current_user_id(request) or "system"
        now_iso = datetime.now(timezone.utc).isoformat()
        approved_at = now_iso if body.role in ("approved", "admin") else None
        insert_payload: dict = {
            "user_id": user_id,
            "role": body.role,
            "approved_by": admin_id,
            "approved_at": approved_at,
        }
        if body.first_name is not None:
            insert_payload["first_name"] = body.first_name
        if body.last_name is not None:
            insert_payload["last_name"] = body.last_name
        supabase.table("user_roles").insert(insert_payload).execute()

        return CreateUserResponse(
            user_id=user_id,
            email=body.email,
            role=body.role,
            message=f"User created with role {body.role}. They can sign in immediately.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create user failed: %s", e)
        msg = str(e).lower()
        if "already" in msg or "exists" in msg or "duplicate" in msg:
            raise HTTPException(409, "A user with this email already exists")
        raise HTTPException(500, f"Failed to create user: {e}")
