"""Deep Research scaffold API routes."""

from __future__ import annotations

from fastapi import APIRouter

from backend.common import LangGraphRuntime, RedisClientManager
from backend.config import get_settings
from backend.db import DatabaseConnectionManager
from backend.models import HealthStatus, ServiceDependencyStatus

router = APIRouter(prefix="/api/deep-research", tags=["deep-research"])


@router.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    """Readiness endpoint for scaffolded Deep Research architecture."""
    settings = get_settings()

    db_ok, db_msg = DatabaseConnectionManager(settings).ping()
    redis_ok, redis_msg = RedisClientManager(settings).ping()
    langgraph_ok, langgraph_msg = LangGraphRuntime(
        enabled=settings.langgraph_enabled
    ).check()

    return HealthStatus(
        service=settings.app_name,
        environment=settings.environment,
        dependencies=[
            ServiceDependencyStatus(
                name="postgres",
                enabled=True,
                healthy=db_ok,
                message=db_msg,
            ),
            ServiceDependencyStatus(
                name="redis",
                enabled=True,
                healthy=redis_ok,
                message=redis_msg,
            ),
            ServiceDependencyStatus(
                name="langgraph",
                enabled=settings.langgraph_enabled,
                healthy=langgraph_ok,
                message=langgraph_msg,
            ),
        ],
    )

