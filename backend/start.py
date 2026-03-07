"""Programmatic startup entrypoint for Deep Research API scaffold."""

from __future__ import annotations

import uvicorn

from backend.config import get_settings, load_environment


def main() -> None:
    load_environment()
    settings = get_settings()
    uvicorn.run(
        "backend.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()

