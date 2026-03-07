"""Competitors router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from backend.models.deep_research_api import (
    ApiResponse,
    CompetitorListData,
    CompetitorRequest,
)

from .utils import ok

router = APIRouter(prefix="/competitors", tags=["deep-research-competitors"])


@router.post("/compute", response_model=ApiResponse[CompetitorListData])
async def compute_competitors(body: CompetitorRequest) -> ApiResponse[CompetitorListData]:
    # Stub response: returns no competitors until retrieval logic is implemented.
    return ok(CompetitorListData(company_id=body.company_id, items=[]))


@router.get("/company/{company_id}", response_model=ApiResponse[CompetitorListData])
async def list_competitors(company_id: uuid.UUID) -> ApiResponse[CompetitorListData]:
    return ok(CompetitorListData(company_id=company_id, items=[]))

