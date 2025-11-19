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

@lru_cache()
def get_supabase_client() -> Client:
    """Get Supabase client (singleton)"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(url, key)

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

