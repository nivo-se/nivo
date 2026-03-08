"""Redis client scaffolding for Deep Research."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import redis

from backend.config.settings import AppSettings, get_settings


@dataclass(slots=True)
class RedisClientManager:
    """Runtime Redis manager for health checks and future queues/cache."""

    settings: AppSettings

    def client(self) -> redis.Redis:
        return redis.Redis.from_url(self.settings.redis_url, socket_connect_timeout=5)

    def ping(self) -> tuple[bool, Optional[str]]:
        try:
            self.client().ping()
            return True, None
        except Exception as exc:  # pragma: no cover - defensive runtime check
            return False, str(exc)

    @staticmethod
    def get_connection() -> redis.Redis:
        """Return a Redis connection using the current app settings."""
        settings = get_settings()
        return redis.Redis.from_url(settings.redis_url, socket_connect_timeout=5)

