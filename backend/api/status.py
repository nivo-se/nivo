"""
Status and health check endpoints
"""
from fastapi import APIRouter
from .dependencies import get_supabase_client, get_redis_client

router = APIRouter(tags=["status"])


@router.get("/status")
async def get_status():
    """
    Comprehensive status check for all services.
    """
    status = {
        "api": "healthy",
        "supabase": "unknown",
        "redis": "unknown",
    }
    
    # Check Supabase
    try:
        supabase = get_supabase_client()
        # Simple query to test connection
        supabase.table("companies").select("orgnr").limit(1).execute()
        status["supabase"] = "healthy"
    except Exception as e:
        status["supabase"] = f"error: {str(e)}"
    
    # Check Redis
    try:
        redis_client = get_redis_client()
        redis_client.ping()
        status["redis"] = "healthy"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
    
    all_healthy = all(
        status[key] == "healthy" 
        for key in ["api", "supabase", "redis"]
    )
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": status,
    }

