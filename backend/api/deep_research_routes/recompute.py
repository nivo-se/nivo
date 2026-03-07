"""Recompute router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from backend.models.deep_research_api import (
    ApiResponse,
    RecomputeData,
    RecomputeReportRequest,
    RecomputeSectionRequest,
)

from .utils import ok

router = APIRouter(prefix="/recompute", tags=["deep-research-recompute"])


@router.post("/section", response_model=ApiResponse[RecomputeData])
async def recompute_section(body: RecomputeSectionRequest) -> ApiResponse[RecomputeData]:
    return ok(
        RecomputeData(
            job_id=uuid.uuid4(),
            report_version_id=body.report_version_id,
            status="queued",
        )
    )


@router.post("/report", response_model=ApiResponse[RecomputeData])
async def recompute_report(body: RecomputeReportRequest) -> ApiResponse[RecomputeData]:
    return ok(
        RecomputeData(
            job_id=uuid.uuid4(),
            report_version_id=body.report_version_id,
            status="queued",
        )
    )

