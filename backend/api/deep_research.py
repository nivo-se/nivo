"""Deep Research scaffold API routes."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.deep_research_routes import (
    analysis_router,
    competitors_router,
    recompute_router,
    reports_router,
    sources_router,
    verification_router,
)
from backend.api.deep_research_routes.utils import ok
from backend.common import LangGraphRuntime, RedisClientManager
from backend.config import get_settings
from backend.db import DatabaseConnectionManager
from backend.models.deep_research_api import (
    ApiResponse,
    DeepResearchHealthData,
    HealthDependencyData,
)

router = APIRouter(prefix="/api/deep-research", tags=["deep-research"])


@router.get("/health", response_model=ApiResponse[DeepResearchHealthData])
async def health() -> ApiResponse[DeepResearchHealthData]:
    """Readiness endpoint for scaffolded Deep Research architecture."""
    settings = get_settings()

    db_ok, db_msg = DatabaseConnectionManager(settings).ping()
    redis_ok, redis_msg = RedisClientManager(settings).ping()
    langgraph_ok, langgraph_msg = LangGraphRuntime(
        enabled=settings.langgraph_enabled
    ).check()

    return ok(
        DeepResearchHealthData(
            service=settings.app_name,
            environment=settings.environment,
            dependencies=[
                HealthDependencyData(
                    name="postgres",
                    enabled=True,
                    healthy=db_ok,
                    message=db_msg,
                ),
                HealthDependencyData(
                    name="redis",
                    enabled=True,
                    healthy=redis_ok,
                    message=redis_msg,
                ),
                HealthDependencyData(
                    name="langgraph",
                    enabled=settings.langgraph_enabled,
                    healthy=langgraph_ok,
                    message=langgraph_msg,
                ),
            ],
        )
    )


router.include_router(analysis_router)
router.include_router(reports_router)
router.include_router(competitors_router)
router.include_router(verification_router)
router.include_router(sources_router)
router.include_router(recompute_router)

