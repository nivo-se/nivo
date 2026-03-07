"""Deep Research FastAPI application factory and startup."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.deep_research import router as deep_research_router
from backend.config import configure_logging, get_settings, load_environment


def create_app() -> FastAPI:
    """Create FastAPI app with architecture scaffold wiring."""
    load_environment()
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Scaffolded backend architecture for Nivo Deep Research",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def root_health() -> dict:
        return {"status": "ok", "service": settings.app_name}

    app.include_router(deep_research_router)
    return app


app = create_app()

