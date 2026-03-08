"""Verification router for Deep Research API — reads from claim_verifications table."""

from __future__ import annotations

import uuid
from collections import defaultdict

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
        repo.persist_claim_verifications(run_id=run.id, claim_updates=claim_updates)
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

        verif_rows = repo.list_claim_verifications(run_id)
        if not verif_rows:
            node_rows = repo.list_node_states(run_id)
            verification_node = next(
                (row for row in node_rows if row.node_name == "verification"), None
            )
            if verification_node is None:
                return ok(
                    VerificationData(
                        verification_id=uuid.uuid5(uuid.NAMESPACE_URL, f"{run_id}:verification"),
                        run_id=run_id,
                        status="queued",
                        issues=[],
                        stats={},
                    )
                )
            output = verification_node.output_json if isinstance(verification_node.output_json, dict) else {}
            node_status = "completed" if verification_node.status == "completed" else "failed"
            return ok(
                VerificationData(
                    verification_id=uuid.uuid5(uuid.NAMESPACE_URL, f"{run_id}:verification"),
                    run_id=run_id,
                    status=node_status,
                    issues=list(output.get("issues", [])),
                    stats=dict(output.get("stats", {})),
                )
            )

        total = len(verif_rows)
        by_status: dict[str, int] = defaultdict(int)
        for row in verif_rows:
            by_status[row.status] += 1

        supported = by_status.get("SUPPORTED", 0)
        unsupported = by_status.get("UNSUPPORTED", 0)
        uncertain = by_status.get("UNCERTAIN", 0)

        issues: list[str] = []
        if unsupported > 0:
            issues.append("some_claims_unsupported")
        if uncertain > 0:
            issues.append("some_claims_uncertain")

        overall_status = "completed" if unsupported == 0 else "completed"

        return ok(
            VerificationData(
                verification_id=uuid.uuid5(uuid.NAMESPACE_URL, f"{run_id}:verification"),
                run_id=run_id,
                status=overall_status,
                issues=issues,
                stats={
                    "total_claims": total,
                    "claims_supported": supported,
                    "claims_unsupported": unsupported,
                    "claims_uncertain": uncertain,
                },
            )
        )

