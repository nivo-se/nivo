"""Shared response helpers for Deep Research API routes."""

from __future__ import annotations

import uuid
from typing import TypeVar

from backend.models.deep_research_api import ApiMeta, ApiResponse

T = TypeVar("T")


def ok(data: T) -> ApiResponse[T]:
    """Return a success response wrapper with generated request id."""
    return ApiResponse(
        success=True,
        data=data,
        error=None,
        meta=ApiMeta(request_id=str(uuid.uuid4())),
    )

