"""SQLAlchemy engine and session utilities for persistence layer."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config.settings import get_settings


def get_engine(echo: bool = False):
    settings = get_settings()
    return create_engine(settings.postgres_dsn, pool_pre_ping=True, echo=echo, future=True)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

