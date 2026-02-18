"""
Database health endpoints.
"""
import logging
import os

from fastapi import APIRouter, Response

from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/db", tags=["db"])


@router.get("/ping")
async def db_ping(response: Response):
    """
    Lightweight health check: runs SELECT 1 using the configured db service.
    Returns 200 if pool/connection is healthy, 503 if not.
    """
    if os.getenv("DATABASE_SOURCE", "local").lower() != "postgres":
        response.status_code = 503
        return {"ok": False, "reason": "DATABASE_SOURCE is not postgres"}

    try:
        db = get_database_service()
        if hasattr(db, "ping") and callable(db.ping):
            ok = db.ping()
        else:
            rows = db.run_raw_query("SELECT 1 AS ok")
            ok = bool(rows and rows[0].get("ok") == 1)
        if not ok:
            response.status_code = 503
        return {"ok": ok}
    except Exception as e:
        logger.warning("db/ping failed: %s", e)
        response.status_code = 503
        return {"ok": False, "reason": str(e)}


@router.get("/info")
async def db_info():
    """
    Read-only DB metadata for smoke checks and diagnostics.
    """
    db_source = os.getenv("DATABASE_SOURCE", "local").lower()
    info = {
        "database_source": db_source,
        "engine": "postgres" if db_source == "postgres" else db_source,
        "version": None,
        "current_database": None,
    }

    if db_source != "postgres":
        return info

    try:
        db = get_database_service()
        rows = db.run_raw_query("SELECT version() AS version, current_database() AS current_database")
        if rows:
            info["version"] = rows[0].get("version")
            info["current_database"] = rows[0].get("current_database")
    except Exception as e:
        logger.warning("db/info failed: %s", e)
        info["error"] = str(e)

    return info
