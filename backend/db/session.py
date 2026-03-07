"""SQLAlchemy engine and session utilities for persistence layer."""

from __future__ import annotations

from collections.abc import Generator
import os
import socket

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config.settings import get_settings


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.25):
            return True
    except Exception:
        return False


def _build_dsn() -> str:
    settings = get_settings()
    env_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if env_url:
        return env_url

    host = os.getenv("POSTGRES_HOST")
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    dbname = os.getenv("POSTGRES_DB")
    port = os.getenv("POSTGRES_PORT")

    if host or user or password or dbname or port:
        host = host or "localhost"
        user = user or "nivo"
        password = password or "nivo"
        dbname = dbname or "nivo"
        if port:
            resolved_port = int(port)
        else:
            # Prefer docker-compose local default, then native postgres.
            resolved_port = 5433 if _port_open(host, 5433) else 5432
        return f"postgresql://{user}:{password}@{host}:{resolved_port}/{dbname}"

    return settings.postgres_dsn


def get_engine(echo: bool = False):
    return create_engine(_build_dsn(), pool_pre_ping=True, echo=echo, future=True)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

