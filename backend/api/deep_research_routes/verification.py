"""Verification router for Deep Research API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun
from backend.models.deep_research_api import ApiResponse, VerificationData, VerificationRequest
from backend.orchestrator.persistence import RunStateRepository
from backend.verification import VerificationPipeline

from .utils import ok

router = APIRouter(prefix="/verification", tags=["deep-research-verification"])


@router.post("/run", response_model=ApiResponse[VerificationData])
async def run_verification(body: VerificationRequest) -> ApiResponse[VerificationData]:
    with SessionLocal() as session:
        run = session.get(AnalysisRun, body.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="analysis run not found")
        if run.company_id is None:
            raise HTTPException(
                status_code=400, detail="analysis run has no associated company"
            )
        repo = RunStateRepository(session)
        claims = repo.list_claims_for_run(run.id, run.company_id)
        pipeline = VerificationPipeline()
        result = pipeline.run(claims, strict_mode=body.strict_mode)
        claim_updates = result.pop("claim_updates", [])
        repo.apply_claim_verification(claim_updates)
        repo.upsert_node_state(
            run_id=run.id,
            node_name="verification",
            status="completed" if result.get("status") == "completed" else "failed",
            input_json={"strict_mode": body.strict_mode},
            output_json=result,
            error_message=None,
        )
        session.commit()
        return ok(
            VerificationData(
                verification_id=uuid.uuid5(
                    uuid.NAMESPACE_URL, f"{run.id}:verification:{body.strict_mode}"
                ),
                run_id=body.run_id,
                status="completed" if result.get("status") == "completed" else "failed",
                issues=list(result.get("issues", [])),
                stats=dict(result.get("stats", {})),
            )
        )


@router.get("/runs/{run_id}", response_model=ApiResponse[VerificationData])
async def get_verification(run_id: uuid.UUID) -> ApiResponse[VerificationData]:
    with SessionLocal() as session:
        run = session.get(AnalysisRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="analysis run not found")
        repo = RunStateRepository(session)
        node_rows = repo.list_node_states(run_id)
        verification_row = next(
            (row for row in node_rows if row.node_name == "verification"), None
        )
        if verification_row is None:
            return ok(
                VerificationData(
                    verification_id=uuid.uuid5(uuid.NAMESPACE_URL, f"{run_id}:verification"),
                    run_id=run_id,
                    status="queued",
                    issues=[],
                    stats={},
                )
            )
        output = verification_row.output_json if isinstance(verification_row.output_json, dict) else {}
        status = "completed" if verification_row.status == "completed" else "failed"
        return ok(
            VerificationData(
                verification_id=uuid.uuid5(uuid.NAMESPACE_URL, f"{run_id}:verification"),
                run_id=run_id,
                status=status,
                issues=list(output.get("issues", [])),
                stats=dict(output.get("stats", {})),
            )
        )

