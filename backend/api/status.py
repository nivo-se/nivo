"""
Status and health check endpoints
"""
import os
from fastapi import APIRouter
from .dependencies import get_supabase_client, get_redis_client
from ..services.db_factory import get_database_service

router = APIRouter(prefix="/api", tags=["status"])

TABLES_FOR_STATUS = [
    "companies",
    "financials",
    "company_kpis",
    "enrichment_runs",
    "company_enrichment",
    "ai_profiles",
]


@router.get("/status")
async def get_status():
    """
    Comprehensive status check. Returns db_source, db_ok, tables_ok, counts.
    """
    db_source = os.getenv("DATABASE_SOURCE", "local").lower()
    db_ok = False
    tables_ok = {}
    counts = {}

    try:
        db = get_database_service()
        db.run_raw_query("SELECT orgnr FROM companies LIMIT 1")
        db_ok = True
    except Exception:
        pass

    if db_ok:
        try:
            db = get_database_service()
            for table in TABLES_FOR_STATUS:
                tables_ok[table] = db.table_exists(table)
        except Exception:
            tables_ok = {t: False for t in TABLES_FOR_STATUS}

        # Counts for readiness
        try:
            db = get_database_service()
            for table in TABLES_FOR_STATUS:
                if tables_ok.get(table):
                    try:
                        rows = db.run_raw_query(f"SELECT COUNT(*) as n FROM {table}")
                        counts[table] = int(rows[0]["n"]) if rows else 0
                    except Exception:
                        counts[table] = -1
                else:
                    counts[table] = -1
        except Exception:
            counts = {t: -1 for t in TABLES_FOR_STATUS}

    status = {
        "api": "healthy",
        "db_source": db_source,
        "db_ok": db_ok,
        "tables_ok": tables_ok,
        "counts": counts,
    }

    # Supabase when relevant
    status["supabase"] = "n/a" if db_source != "supabase" else "unknown"
    if db_source == "supabase":
        try:
            supabase = get_supabase_client()
            if supabase:
                supabase.table("companies").select("orgnr").limit(1).execute()
                status["supabase"] = "healthy"
            else:
                status["supabase"] = "error: not configured"
        except Exception as e:
            status["supabase"] = f"error: {str(e)}"

    # Redis
    status["redis"] = "unknown"
    try:
        redis_client = get_redis_client()
        redis_client.ping()
        status["redis"] = "healthy"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"

    required = ["api", "db_ok"]
    all_healthy = db_ok and all(status.get(key) in ("healthy", True) for key in ("api", "db_ok"))

    return {
        "status": "healthy" if all_healthy else "degraded",
        **status,
    }


@router.get("/status/config")
async def get_config():
    """
    Effective config (no secrets). For ops verification.
    """
    db_source = os.getenv("DATABASE_SOURCE", "local").lower()
    require_auth = os.getenv("REQUIRE_AUTH", "false").lower() in ("1", "true", "yes")

    # CORS origins count (from default + CORS_ORIGINS)
    default_count = 10  # localhost ports in main.py
    cors_extra = os.getenv("CORS_ORIGINS", "")
    cors_origins_count = default_count + (
        len([o for o in cors_extra.split(",") if o.strip()]) if cors_extra else 0
    )
    if os.getenv("CORS_ALLOW_VERCEL_PREVIEWS", "").lower() in ("1", "true", "yes"):
        cors_origins_count = str(cors_origins_count) + "+vercel_regex"

    redis_connected = "no"
    try:
        r = get_redis_client()
        r.ping()
        redis_connected = "yes"
    except Exception:
        pass

    llm_provider = "not configured"
    try:
        from ..llm.provider_factory import get_llm_provider

        p = get_llm_provider()
        llm_provider = p.__class__.__name__ if p else "none"
    except Exception:
        pass

    return {
        "db_source": db_source,
        "require_auth": require_auth,
        "cors_origins_count": cors_origins_count,
        "redis_connected": redis_connected,
        "llm_provider": llm_provider,
    }

