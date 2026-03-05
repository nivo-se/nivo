"""
Shared dependencies for FastAPI endpoints
"""
from functools import lru_cache
import redis
from dotenv import load_dotenv
from pathlib import Path
import os
from typing import Optional

from fastapi import Request

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


def get_current_user_id(request: Request) -> Optional[str]:
    """
    Get current user ID (sub) from request.state.user set by JWTAuthMiddleware.
    Returns None when auth is disabled or no user.
    """
    user = getattr(request.state, "user", None)
    if not user or not isinstance(user, dict):
        return None
    sub = user.get("sub")
    return str(sub) if sub else None


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
