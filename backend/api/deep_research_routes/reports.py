"""Reports router for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Company, ReportVersion
from backend.models.deep_research_api import (
    ApiResponse,
    ReportDetailData,
    ReportGenerateRequest,
    ReportSectionData,
    ReportVersionListData,
    ReportVersionSummary,
    ValidationStatusData,
)
from backend.orchestrator.persistence import RunStateRepository
from backend.report_engine import ReportComposer

from .utils import ok

router = APIRouter(prefix="/reports", tags=["deep-research-reports"])


def _to_report_detail(row: ReportVersion, company_name: str | None = None) -> ReportDetailData:
    sections = sorted(list(row.sections), key=lambda s: (s.sort_order, s.section_key))
    extra = row.extra if isinstance(row.extra, dict) else {}
    vs = extra.get("validation_status")
    validation_status = None
    if isinstance(vs, dict):
        validation_status = ValidationStatusData(
            lint_passed=vs.get("lint_passed", True),
            lint_warnings=vs.get("lint_warnings", []) or [],
        )
    return ReportDetailData(
        report_version_id=row.id,
        run_id=row.run_id,
        company_id=row.company_id,
        company_name=company_name,
        status=row.status,
        title=row.title,
        version_number=row.version_number,
        report_degraded=extra.get("report_degraded", False),
        report_degraded_reasons=extra.get("report_degraded_reasons", []),
        validation_status=validation_status,
        sections=[
            ReportSectionData(
                section_key=section.section_key,
                heading=section.heading,
                content_md=section.content_md,
                sort_order=section.sort_order,
            )
            for section in sections
        ],
    )


def _resolve_company_name(session, company_id: uuid.UUID | None) -> str | None:
    if not company_id:
        return None
    company = session.get(Company, company_id)
    return company.name if company else None


@router.post("/generate", response_model=ApiResponse[ReportDetailData])
async def generate_report(body: ReportGenerateRequest) -> ApiResponse[ReportDetailData]:
    with SessionLocal() as session:
        run = session.get(AnalysisRun, body.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="analysis run not found")
        if run.company_id is None:
            raise HTTPException(
                status_code=400, detail="analysis run has no associated company"
            )
        company = session.get(Company, run.company_id)
        repo = RunStateRepository(session)
        node_rows = repo.list_node_states(run.id)
        node_results = {
            row.node_name: row.output_json
            for row in node_rows
            if isinstance(row.output_json, dict) and row.output_json
        }
        if not node_results:
            raise HTTPException(
                status_code=400,
                detail="cannot generate report before analysis nodes have produced output",
            )

        composer = ReportComposer()
        payload = composer.compose(
            company_name=company.name if company else (run.query or "Unknown Company"),
            node_results=node_results,
        )
        report = repo.persist_report(
            run_id=run.id,
            company_id=run.company_id,
            payload=payload,
        )
        session.commit()

        row = session.execute(
            select(ReportVersion)
            .options(selectinload(ReportVersion.sections))
            .where(ReportVersion.id == report.id)
        ).scalar_one()
        return ok(_to_report_detail(row, company_name=company.name if company else None))


@router.get("/versions/{report_version_id}", response_model=ApiResponse[ReportDetailData])
async def get_report_version(report_version_id: uuid.UUID) -> ApiResponse[ReportDetailData]:
    with SessionLocal() as session:
        row = session.execute(
            select(ReportVersion)
            .options(selectinload(ReportVersion.sections))
            .where(ReportVersion.id == report_version_id)
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="report version not found")
        return ok(_to_report_detail(row, company_name=_resolve_company_name(session, row.company_id)))


@router.get("/company/{company_id}/latest", response_model=ApiResponse[ReportDetailData])
async def get_latest_report_for_company(
    company_id: uuid.UUID,
) -> ApiResponse[ReportDetailData]:
    with SessionLocal() as session:
        row = session.execute(
            select(ReportVersion)
            .options(selectinload(ReportVersion.sections))
            .where(ReportVersion.company_id == company_id)
            .order_by(ReportVersion.created_at.desc())
        ).scalars().first()
        if row is None:
            raise HTTPException(status_code=404, detail="no report found for company")
        return ok(_to_report_detail(row, company_name=_resolve_company_name(session, company_id)))


@router.get("/run/{run_id}/latest", response_model=ApiResponse[ReportDetailData])
async def get_latest_report_for_run(
    run_id: uuid.UUID,
) -> ApiResponse[ReportDetailData]:
    """Fallback: fetch latest report linked to a specific analysis run."""
    with SessionLocal() as session:
        row = session.execute(
            select(ReportVersion)
            .options(selectinload(ReportVersion.sections))
            .where(ReportVersion.run_id == run_id)
            .order_by(ReportVersion.created_at.desc())
        ).scalars().first()
        if row is None:
            raise HTTPException(status_code=404, detail="no report found for run")
        return ok(_to_report_detail(row, company_name=_resolve_company_name(session, row.company_id)))


@router.get("/company/{company_id}/versions", response_model=ApiResponse[ReportVersionListData])
async def list_report_versions(company_id: uuid.UUID) -> ApiResponse[ReportVersionListData]:
    with SessionLocal() as session:
        rows = session.execute(
            select(ReportVersion)
            .where(ReportVersion.company_id == company_id)
            .order_by(ReportVersion.created_at.desc())
        ).scalars().all()
        items = [
            ReportVersionSummary(
                report_version_id=r.id,
                run_id=r.run_id,
                version_number=r.version_number,
                status=r.status,
                title=r.title,
                created_at=r.created_at,
            )
            for r in rows
        ]
        return ok(ReportVersionListData(company_id=company_id, versions=items))

