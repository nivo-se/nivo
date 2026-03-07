"""Competitors router for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import select

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Competitor
from backend.models.deep_research_api import (
    ApiResponse,
    CompetitorItem,
    CompetitorListData,
    CompetitorRequest,
)

from .utils import ok

router = APIRouter(prefix="/competitors", tags=["deep-research-competitors"])


@router.post("/compute", response_model=ApiResponse[CompetitorListData])
async def compute_competitors(body: CompetitorRequest) -> ApiResponse[CompetitorListData]:
    with SessionLocal() as session:
        latest_run = session.execute(
            select(AnalysisRun)
            .where(AnalysisRun.company_id == body.company_id)
            .order_by(AnalysisRun.created_at.desc())
        ).scalars().first()
        if latest_run is None:
            return ok(CompetitorListData(company_id=body.company_id, items=[]))
        rows = session.execute(
            select(Competitor)
            .where(
                Competitor.run_id == latest_run.id,
                Competitor.company_id == body.company_id,
            )
            .order_by(Competitor.relation_score.desc().nullslast(), Competitor.created_at.asc())
            .limit(body.top_n)
        ).scalars()
        items = [
            CompetitorItem(
                competitor_id=row.id,
                name=row.competitor_name,
                relation_score=float(row.relation_score) if row.relation_score is not None else None,
                website=row.website,
            )
            for row in rows
        ]
        return ok(CompetitorListData(company_id=body.company_id, items=items))


@router.get("/company/{company_id}", response_model=ApiResponse[CompetitorListData])
async def list_competitors(company_id: uuid.UUID) -> ApiResponse[CompetitorListData]:
    with SessionLocal() as session:
        latest_run = session.execute(
            select(AnalysisRun)
            .where(AnalysisRun.company_id == company_id)
            .order_by(AnalysisRun.created_at.desc())
        ).scalars().first()
        if latest_run is None:
            return ok(CompetitorListData(company_id=company_id, items=[]))
        rows = session.execute(
            select(Competitor)
            .where(Competitor.run_id == latest_run.id, Competitor.company_id == company_id)
            .order_by(Competitor.relation_score.desc().nullslast(), Competitor.created_at.asc())
        ).scalars()
        items = [
            CompetitorItem(
                competitor_id=row.id,
                name=row.competitor_name,
                relation_score=float(row.relation_score) if row.relation_score is not None else None,
                website=row.website,
            )
            for row in rows
        ]
        return ok(CompetitorListData(company_id=company_id, items=items))

