"""
Shared dependencies for FastAPI endpoints
"""
from functools import lru_cache
from supabase import create_client, Client
import redis
from dotenv import load_dotenv
from pathlib import Path
import os
from typing import Optional

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


def _is_supabase_mode() -> bool:
    """True only when DATABASE_SOURCE=supabase."""
    return os.getenv("DATABASE_SOURCE", "local").lower() == "supabase"


@lru_cache()
def get_supabase_client() -> Optional[Client]:
    """
    Get Supabase client (singleton). Returns None unless DATABASE_SOURCE=supabase.
    Uses SUPABASE_SERVICE_ROLE_KEY server-side only (never expose to frontend).
    """
    if not _is_supabase_mode():
        return None
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def require_supabase_message() -> str:
    """Message for endpoints that require DATABASE_SOURCE=supabase."""
    return "This feature requires DATABASE_SOURCE=supabase"

@lru_cache()
def get_redis_client() -> redis.Redis:
    """Get Redis client (singleton)"""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.from_url(redis_url, decode_responses=True)
        # Test connection
        client.ping()
        return client
    except redis.ConnectionError as e:
        raise ConnectionError(f"Failed to connect to Redis at {redis_url}: {e}")

