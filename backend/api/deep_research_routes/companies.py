"""Companies router for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Company, ReportVersion
from backend.models.deep_research_api import (
    ApiResponse,
    CompanyWithReportData,
)

from .utils import ok

router = APIRouter(prefix="/companies", tags=["deep-research-companies"])


@router.get("", response_model=ApiResponse[list[CompanyWithReportData]])
async def list_companies_with_reports() -> ApiResponse[list[CompanyWithReportData]]:
    """Return companies that have at least one report, ordered by most recent report."""
    with SessionLocal() as session:
        latest_report = (
            select(
                ReportVersion.company_id,
                func.max(ReportVersion.created_at).label("max_created"),
            )
            .group_by(ReportVersion.company_id)
            .subquery()
        )

        run_counts = (
            select(
                AnalysisRun.company_id,
                func.count(AnalysisRun.id).label("cnt"),
            )
            .group_by(AnalysisRun.company_id)
            .subquery()
        )

        rows = session.execute(
            select(
                Company.id,
                Company.name,
                ReportVersion.id.label("report_id"),
                ReportVersion.title,
                ReportVersion.created_at,
                run_counts.c.cnt,
            )
            .join(latest_report, Company.id == latest_report.c.company_id)
            .join(
                ReportVersion,
                (ReportVersion.company_id == Company.id)
                & (ReportVersion.created_at == latest_report.c.max_created),
            )
            .outerjoin(run_counts, Company.id == run_counts.c.company_id)
            .order_by(ReportVersion.created_at.desc())
        ).all()

        items = [
            CompanyWithReportData(
                company_id=r.id,
                company_name=r.name,
                latest_report_id=r.report_id,
                latest_report_title=r.title,
                updated_at=r.created_at,
                run_count=r.cnt or 0,
            )
            for r in rows
        ]
        return ok(items)


@router.get("/{company_id}", response_model=ApiResponse[CompanyWithReportData])
async def get_company(company_id: uuid.UUID) -> ApiResponse[CompanyWithReportData]:
    with SessionLocal() as session:
        company = session.get(Company, company_id)
        if company is None:
            raise HTTPException(status_code=404, detail="company not found")
        run_count = session.execute(
            select(func.count(AnalysisRun.id)).where(AnalysisRun.company_id == company_id)
        ).scalar() or 0
        latest = session.execute(
            select(ReportVersion)
            .where(ReportVersion.company_id == company_id)
            .order_by(ReportVersion.created_at.desc())
        ).scalars().first()
        return ok(
            CompanyWithReportData(
                company_id=company.id,
                company_name=company.name,
                latest_report_id=latest.id if latest else None,
                latest_report_title=latest.title if latest else None,
                updated_at=latest.created_at if latest else None,
                run_count=run_count,
            )
        )
