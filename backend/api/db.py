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
