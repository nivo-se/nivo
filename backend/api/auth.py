"""
Supabase JWT auth for FastAPI.

Verifies Bearer token from Authorization header and attaches user to request.state.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Paths that bypass auth when REQUIRE_AUTH=true
PUBLIC_PATHS = {"/health", "/api/status", "/docs", "/redoc", "/openapi.json"}


def _should_require_auth() -> bool:
    return os.getenv("REQUIRE_AUTH", "false").lower() in ("true", "1", "yes")


def _get_jwt_secret() -> Optional[str]:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip() or None


def _verify_token(token: str) -> Optional[dict]:
    secret = _get_jwt_secret()
    if not secret:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_exp": True, "verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("JWT invalid: %s", e)
        return None


def _is_public_path(path: str) -> bool:
    path = path.rstrip("/") or "/"
    for p in PUBLIC_PATHS:
        if path == p or path.startswith(p + "/"):
            return True
    return False


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Verifies Supabase JWT on /api routes when REQUIRE_AUTH=true.
    Sets request.state.user = { sub, email, ... } on success.
    Returns 401 { "error": "unauthorized" } when token missing/invalid.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not _should_require_auth():
            request.state.user = None
            return await call_next(request)

        path = request.url.path
        if _is_public_path(path):
            request.state.user = None
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return Response(
                status_code=401,
                content='{"error":"unauthorized"}',
                media_type="application/json",
            )

        token = auth_header[7:].strip()
        if not token:
            return Response(
                status_code=401,
                content='{"error":"unauthorized"}',
                media_type="application/json",
            )

        payload = _verify_token(token)
        if not payload:
            return Response(
                status_code=401,
                content='{"error":"unauthorized"}',
                media_type="application/json",
            )

        request.state.user = {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role"),
            **{k: v for k, v in payload.items() if k not in ("sub", "email", "role")},
        }
        return await call_next(request)
