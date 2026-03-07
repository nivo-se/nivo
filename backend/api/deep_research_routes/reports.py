"""Reports router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from backend.models.deep_research_api import (
    ApiResponse,
    ReportGenerateRequest,
    ReportVersionData,
)

from .utils import ok

router = APIRouter(prefix="/reports", tags=["deep-research-reports"])


@router.post("/generate", response_model=ApiResponse[ReportVersionData])
async def generate_report(body: ReportGenerateRequest) -> ApiResponse[ReportVersionData]:
    return ok(
        ReportVersionData(
            report_version_id=uuid.uuid4(),
            run_id=body.run_id,
            status="draft",
            title="Stub Deep Research Report",
        )
    )


@router.get("/versions/{report_version_id}", response_model=ApiResponse[ReportVersionData])
async def get_report_version(report_version_id: uuid.UUID) -> ApiResponse[ReportVersionData]:
    return ok(
        ReportVersionData(
            report_version_id=report_version_id,
            run_id=uuid.uuid4(),
            status="draft",
            title="Stub Report Version",
        )
    )


@router.get("/company/{company_id}/latest", response_model=ApiResponse[ReportVersionData])
async def get_latest_report_for_company(company_id: uuid.UUID) -> ApiResponse[ReportVersionData]:
    return ok(
        ReportVersionData(
            report_version_id=uuid.uuid4(),
            run_id=uuid.uuid4(),
            status="draft",
            title=f"Latest report for {company_id}",
        )
    )

