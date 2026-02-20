"""
FastAPI application for Nivo Intelligence API
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

logger = logging.getLogger(__name__)

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI(
    title="Nivo Intelligence API",
    description="API for company intelligence, enrichment, and AI analysis",
    version="0.1.0"
)

# CORS configuration
# Allow localhost ports and Vercel preview deployments
default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
]

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    default_origins.extend([origin.strip() for origin in cors_origins_env.split(",") if origin.strip()])

# Explicit origins; Authorization header allowed for Bearer tokens. Add prod frontend via CORS_ORIGINS.
cors_config: dict = {
    "allow_origins": default_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],  # includes Authorization for Bearer JWT
}
# Opt-in: add Vercel preview regex only when explicitly enabled (security: avoids trusting any *.vercel.app)
if os.getenv("CORS_ALLOW_VERCEL_PREVIEWS", "").lower() in ("1", "true", "yes"):
    cors_config["allow_origin_regex"] = r"https://.*\.vercel\.app"

app.add_middleware(CORSMiddleware, **cors_config)


def _cors_headers_for_request(request: Request) -> dict:
    """Return CORS headers for the requesting origin (so error responses are not blocked)."""
    origin = request.headers.get("origin", "")
    if origin in default_origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    return {}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log unhandled exceptions and return 500 with JSON. Add CORS headers so browser receives response."""
    logger.exception("Unhandled exception: %s", exc)
    response = JSONResponse(status_code=500, content={"detail": str(exc)})
    for k, v in _cors_headers_for_request(request).items():
        response.headers[k] = v
    return response


# JWT auth when REQUIRE_AUTH=true (prod)
from .auth import JWTAuthMiddleware
app.add_middleware(JWTAuthMiddleware)


@app.on_event("startup")
def _check_auth_config():
    """Fail closed: crash if REQUIRE_AUTH=true but Auth0 config is missing."""
    if os.getenv("REQUIRE_AUTH", "").lower() not in ("true", "1", "yes"):
        return
    domain = (os.getenv("AUTH0_DOMAIN") or "").strip()
    audience = (os.getenv("AUTH0_AUDIENCE") or "").strip()
    if not domain or not audience:
        raise RuntimeError(
            "REQUIRE_AUTH is true but AUTH0_DOMAIN or AUTH0_AUDIENCE is missing. "
            "Set both in .env and restart. Refusing to run in half-configured state."
        )


# Ping - no DB, no deps; use to isolate hang (before vs after FastAPI)
@app.get("/ping")
def ping():
    return {"ok": True}

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "nivo-intelligence-api"}

# Import routers. All app API routes live under /api/* (e.g. /api/me, /api/admin/*) for consistent CORS and proxy/tunnel routing.
from . import admin_users, bootstrap, ai_credits, ai_filter, ai_reports, companies, coverage, db, debug, enrichment, export, filters, home, jobs, labels, lists, me, prospects, shortlists, status, analysis, saved_lists, universe, views
from .chat import router as chat_router
from .enrichment import router as enrichment_router

app.include_router(me.router)
app.include_router(bootstrap.router)
app.include_router(admin_users.router)
app.include_router(ai_credits.router)
app.include_router(coverage.router)
app.include_router(home.router)
app.include_router(views.router)
app.include_router(lists.router)
app.include_router(prospects.router)
app.include_router(labels.router)
app.include_router(universe.router)
app.include_router(db.router)
app.include_router(debug.router)
app.include_router(filters.router)
app.include_router(ai_filter.router)
app.include_router(enrichment_router)
app.include_router(export.router)
app.include_router(jobs.router)
app.include_router(companies.router)
app.include_router(status.router)
app.include_router(ai_reports.router)
app.include_router(shortlists.router)
app.include_router(saved_lists.router)
app.include_router(analysis.router)
app.include_router(chat_router)

# TODO: Add when implemented
# from . import search
# app.include_router(search.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

