"""
JWT auth for FastAPI. Auth0 only (RS256 + JWKS).

Verifies Bearer token from Authorization header and attaches user to request.state.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Callable, Optional

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Paths that bypass auth when REQUIRE_AUTH=true. Minimal set for production.
# Add more paths here only for local/dev if you run with REQUIRE_AUTH=true and need unauthenticated access.
PUBLIC_PATHS = {
    "/ping",
    "/health",
    "/api/db/ping",  # DB health for dashboards
    "/docs",
    "/redoc",
    "/openapi.json",
}

# In-memory cache for Auth0 JWKS. Refresh on TTL or on kid-miss (key rotation).
_auth0_jwks_cache: Optional[dict] = None
_AUTH0_JWKS_CACHE_TTL = 300  # seconds
_JWKS_FETCH_TIMEOUT = 3  # seconds; short to avoid blocking


def _should_require_auth() -> bool:
    return os.getenv("REQUIRE_AUTH", "false").lower() in ("true", "1", "yes")


def _auth0_domain() -> Optional[str]:
    return os.getenv("AUTH0_DOMAIN", "").strip() or None


def _auth0_audience() -> Optional[str]:
    return os.getenv("AUTH0_AUDIENCE", "").strip() or None


def _auth0_issuer() -> str:
    """Issuer URL with trailing slash (Auth0 and OIDC expect https://<domain>/)."""
    domain = _auth0_domain()
    if not domain:
        return ""
    domain = domain.rstrip("/").replace("https://", "").replace("http://", "")
    return f"https://{domain}/"


def _fetch_auth0_jwks() -> Optional[dict]:
    domain = _auth0_domain()
    if not domain:
        return None
    domain = domain.rstrip("/").replace("https://", "").replace("http://", "")
    url = f"https://{domain}/.well-known/jwks.json"
    try:
        import urllib.request
        with urllib.request.urlopen(url, timeout=_JWKS_FETCH_TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        logger.warning("Failed to fetch Auth0 JWKS: %s", e)
        return None


def _invalidate_jwks_cache() -> None:
    global _auth0_jwks_cache
    _auth0_jwks_cache = None


def _get_auth0_signing_key(token: str, allow_refresh: bool = True):
    """Resolve Auth0 signing key from JWKS by token's kid. Refreshes cache on kid-miss (key rotation)."""
    global _auth0_jwks_cache
    now = time.time()
    if _auth0_jwks_cache is None or (now - _auth0_jwks_cache.get("fetched_at", 0)) > _AUTH0_JWKS_CACHE_TTL:
        jwks = _fetch_auth0_jwks()
        if not jwks:
            return None
        _auth0_jwks_cache = {"keys": jwks.get("keys", []), "fetched_at": now}
    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        if not kid:
            return None
        for key in _auth0_jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    except Exception:
        pass
    if allow_refresh:
        _invalidate_jwks_cache()
        jwks = _fetch_auth0_jwks()
        if jwks:
            _auth0_jwks_cache = {"keys": jwks.get("keys", []), "fetched_at": time.time()}
            return _get_auth0_signing_key(token, allow_refresh=False)
    return None


def _verify_token_auth0(token: str) -> Optional[dict]:
    domain = _auth0_domain()
    audience = _auth0_audience()
    if not domain:
        return None
    issuer = _auth0_issuer()
    key = _get_auth0_signing_key(token)
    if not key:
        return None
    try:
        # issuer: must be https://<domain>/ (trailing slash). aud: Auth0 may send string or list; PyJWT accepts both.
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=audience if audience else None,
            issuer=issuer,
            options={"verify_exp": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("Auth0 JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("Auth0 JWT invalid: %s", e)
        return None


def _verify_token(token: str) -> Optional[dict]:
    if not _auth0_domain():
        return None
    return _verify_token_auth0(token)


def _is_public_path(path: str) -> bool:
    path = path.rstrip("/") or "/"
    for p in PUBLIC_PATHS:
        if path == p or path.startswith(p + "/"):
            return True
    return False


def _cors_allowed_origin(origin: str) -> bool:
    if not origin:
        return False
    allowed = {
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    }
    extra = os.getenv("CORS_ORIGINS", "")
    if extra:
        allowed.update({o.strip() for o in extra.split(",") if o.strip()})
    if origin in allowed:
        return True
    allow_vercel_previews = os.getenv("CORS_ALLOW_VERCEL_PREVIEWS", "").lower() in ("1", "true", "yes")
    return bool(allow_vercel_previews and origin.startswith("https://") and origin.endswith(".vercel.app"))


def _json_401(request: Request) -> Response:
    """Return 401 JSON with CORS headers so the browser can read the response."""
    origin = request.headers.get("origin", "").strip()
    headers = {"Content-Type": "application/json"}
    if _cors_allowed_origin(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return Response(status_code=401, content='{"error":"unauthorized"}', headers=headers)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Verifies Auth0 JWT on /api routes when REQUIRE_AUTH=true.
    Sets request.state.user on success. Returns 401 when token missing/invalid.
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
            return _json_401(request)

        token = auth_header[7:].strip()
        if not token:
            return _json_401(request)

        payload = _verify_token(token)
        if not payload:
            return _json_401(request)

        request.state.user = {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role"),
            **{k: v for k, v in payload.items() if k not in ("sub", "email", "role")},
        }
        return await call_next(request)
