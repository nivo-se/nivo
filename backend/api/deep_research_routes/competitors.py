"""Competitors router for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Competitor
from backend.models.deep_research_api import (
    AddCompetitorRequest,
    ApiResponse,
    CompetitorItem,
    CompetitorListData,
    CompetitorRequest,
    UpdateCompetitorRequest,
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


@router.post("/add", response_model=ApiResponse[CompetitorItem])
async def add_competitor(body: AddCompetitorRequest) -> ApiResponse[CompetitorItem]:
    with SessionLocal() as session:
        competitor = Competitor(
            company_id=body.company_id,
            run_id=body.run_id,
            competitor_name=body.competitor_name,
            website=body.website,
            relation_score=body.relation_score,
        )
        session.add(competitor)
        session.commit()
        session.refresh(competitor)
        return ok(
            CompetitorItem(
                competitor_id=competitor.id,
                name=competitor.competitor_name,
                relation_score=float(competitor.relation_score) if competitor.relation_score is not None else None,
                website=competitor.website,
            )
        )


@router.delete("/{competitor_id}", response_model=ApiResponse[dict])
async def delete_competitor(competitor_id: uuid.UUID) -> ApiResponse[dict]:
    with SessionLocal() as session:
        competitor = session.get(Competitor, competitor_id)
        if competitor is None:
            raise HTTPException(status_code=404, detail="Competitor not found")
        session.delete(competitor)
        session.commit()
        return ok({"deleted": True})


@router.put("/{competitor_id}", response_model=ApiResponse[CompetitorItem])
async def update_competitor(competitor_id: uuid.UUID, body: UpdateCompetitorRequest) -> ApiResponse[CompetitorItem]:
    with SessionLocal() as session:
        competitor = session.get(Competitor, competitor_id)
        if competitor is None:
            raise HTTPException(status_code=404, detail="Competitor not found")
        if body.competitor_name is not None:
            competitor.competitor_name = body.competitor_name
        if body.website is not None:
            competitor.website = body.website
        if body.relation_score is not None:
            competitor.relation_score = body.relation_score
        session.commit()
        session.refresh(competitor)
        return ok(
            CompetitorItem(
                competitor_id=competitor.id,
                name=competitor.competitor_name,
                relation_score=float(competitor.relation_score) if competitor.relation_score is not None else None,
                website=competitor.website,
            )
        )

