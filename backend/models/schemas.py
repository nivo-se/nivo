"""Pydantic schemas used by architecture scaffold."""

from __future__ import annotations

from pydantic import BaseModel


class ServiceDependencyStatus(BaseModel):
    name: str
    enabled: bool
    healthy: bool | None = None
    message: str | None = None


class HealthStatus(BaseModel):
    service: str
    environment: str
    dependencies: list[ServiceDependencyStatus]

