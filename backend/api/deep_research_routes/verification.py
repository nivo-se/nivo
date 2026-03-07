"""Verification router stubs for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from backend.models.deep_research_api import ApiResponse, VerificationData, VerificationRequest

from .utils import ok

router = APIRouter(prefix="/verification", tags=["deep-research-verification"])


@router.post("/run", response_model=ApiResponse[VerificationData])
async def run_verification(body: VerificationRequest) -> ApiResponse[VerificationData]:
    return ok(
        VerificationData(
            verification_id=uuid.uuid4(),
            run_id=body.run_id,
            status="queued",
            issues=[],
        )
    )


@router.get("/runs/{run_id}", response_model=ApiResponse[VerificationData])
async def get_verification(run_id: uuid.UUID) -> ApiResponse[VerificationData]:
    return ok(
        VerificationData(
            verification_id=uuid.uuid4(),
            run_id=run_id,
            status="running",
            issues=[],
        )
    )

