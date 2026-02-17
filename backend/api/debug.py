"""
Debug endpoints for system configuration visibility.
"""
import os
import subprocess
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/debug", tags=["debug"])

from datetime import datetime
_STARTED_AT = datetime.utcnow().isoformat() + "Z"


def _get_git_sha() -> str:
    try:
        repo = Path(__file__).resolve().parents[2]
        out = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=repo,
            text=True,
            timeout=2,
        )
        return out.strip()[:8] if out else "unknown"
    except Exception:
        return os.getenv("GIT_SHA", "unknown")


@router.get("/whoami")
async def whoami():
    """
    Returns backend identity so Admin can show single source of truth.
    Use 127.0.0.1 to avoid IPv6 resolution issues.
    """
    port = os.getenv("PORT", "8000")
    api_base = os.getenv("API_BASE_URL") or f"http://127.0.0.1:{port}"
    db_source = os.getenv("DATABASE_SOURCE", "postgres").lower()
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5433")
    return {
        "api_base": api_base.rstrip("/"),
        "port": int(port),
        "database_source": db_source,
        "db_host": db_host or "localhost",
        "db_port": str(db_port),
        "git_sha": _get_git_sha(),
        "started_at": _STARTED_AT,
    }
