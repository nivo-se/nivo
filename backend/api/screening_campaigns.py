"""
Screening campaigns API: universe shortlist runs (Layer 0 deterministic + future stages).

See docs/deep_research/SCREENING_ORCHESTRATOR_SPEC.md
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from ..services.screening_orchestrator.campaign_service import (
    attach_public_enrichment_to_candidates,
    create_campaign,
    delete_campaign_record,
    get_campaign,
    list_campaigns,
    list_candidates,
    rename_campaign,
    run_layer0_sync,
    run_layer1_campaign_sync,
    run_layer2_campaign_sync,
    run_layer3_campaign_sync,
    set_candidate_exclusion,
)
from ..services.screening_orchestrator.schemas import CreateCampaignBody
from .dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screening/campaigns", tags=["screening-campaigns"])


def _require_postgres() -> None:
    if os.getenv("DATABASE_SOURCE", "postgres").lower() != "postgres":
        raise HTTPException(
            503,
            "Screening campaigns require DATABASE_SOURCE=postgres",
        )


def _require_user(request: Request) -> str:
    uid = get_current_user_id(request)
    if uid:
        return uid
    if os.getenv("REQUIRE_AUTH", "false").lower() not in ("true", "1", "yes"):
        return "00000000-0000-0000-0000-000000000001"
    raise HTTPException(401, "Authentication required")


def _campaign_to_summary(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "profileId": row.get("profile_id"),
        "profileVersionId": row.get("profile_version_id"),
        "status": row.get("status"),
        "currentStage": row.get("current_stage"),
        "statsJson": row.get("stats_json") or {},
        "errorMessage": row.get("error_message"),
        "createdAt": row.get("created_at").isoformat() if row.get("created_at") else None,
        "updatedAt": row.get("updated_at").isoformat() if row.get("updated_at") else None,
    }


class PauseBody(BaseModel):
    reason: Optional[str] = None


class PatchCampaignBody(BaseModel):
    """Rename a screening campaign."""

    name: str = Field(..., min_length=1, max_length=500)


class CandidateExclusionBody(BaseModel):
    excluded_from_analysis: bool = Field(..., alias="excludedFromAnalysis")
    exclusion_reason: Optional[str] = Field(None, alias="exclusionReason")

    model_config = {"populate_by_name": True}


@router.post("")
async def post_create_campaign(request: Request, body: CreateCampaignBody) -> Dict[str, Any]:
    _require_postgres()
    uid = _require_user(request)
    try:
        db = get_database_service()
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {e}") from e

    cid = create_campaign(db, body, uid)
    return {"campaignId": cid, "status": "draft"}


@router.get("")
async def get_campaign_list(request: Request, limit: int = Query(50, ge=1, le=200)) -> Dict[str, Any]:
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    rows = list_campaigns(db, limit=limit)
    return {"items": [_campaign_to_summary(r) for r in rows]}


@router.get("/{campaign_id}")
async def get_one_campaign(request: Request, campaign_id: str) -> Dict[str, Any]:
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    return _campaign_to_summary(row)


@router.patch("/{campaign_id}")
async def patch_screening_campaign(
    request: Request, campaign_id: str, body: PatchCampaignBody
) -> Dict[str, Any]:
    """Rename a campaign."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    ok = rename_campaign(db, campaign_id, body.name.strip())
    if not ok:
        raise HTTPException(400, "Invalid name")
    updated = get_campaign(db, campaign_id)
    return _campaign_to_summary(updated) if updated else {"ok": True, "id": campaign_id}


@router.delete("/{campaign_id}")
async def delete_screening_campaign(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Remove a campaign and its candidates / stages (CASCADE)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    ok = delete_campaign_record(db, campaign_id)
    if not ok:
        raise HTTPException(500, "Failed to delete campaign")
    return {"ok": True, "id": campaign_id}


@router.post("/{campaign_id}/start")
async def post_start_campaign(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Run Layer 0 synchronously in a thread pool (full universe scan may take tens of seconds)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()

    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    if row.get("status") == "running":
        raise HTTPException(409, "Campaign already running")

    try:
        stats = await asyncio.to_thread(run_layer0_sync, db, campaign_id)
    except Exception as e:
        logger.exception("Campaign start failed: %s", e)
        raise HTTPException(500, str(e)) from e

    return {"ok": True, "status": "completed", "layer0": stats}


@router.post("/{campaign_id}/layer1/start")
async def post_layer1_start(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Run Layer 1 relevance (batched LLM) synchronously."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    try:
        stats = await asyncio.to_thread(run_layer1_campaign_sync, db, campaign_id)
    except Exception as e:
        logger.exception("Layer1 start failed: %s", e)
        raise HTTPException(500, str(e)) from e
    return {"ok": True, "status": "completed", "layer1": stats}


@router.post("/{campaign_id}/layer2/start")
async def post_layer2_start(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Run Layer 2 fit scorecard (LLM) on Layer-1 passes (uncertain only if policy allows)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    try:
        stats = await asyncio.to_thread(run_layer2_campaign_sync, db, campaign_id)
    except Exception as e:
        logger.exception("Layer2 start failed: %s", e)
        raise HTTPException(500, str(e)) from e
    return {"ok": True, "status": "completed", "layer2": stats}


@router.post("/{campaign_id}/layer3/start")
async def post_layer3_start(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Run Layer 3 deterministic blend + final_rank."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    try:
        stats = await asyncio.to_thread(run_layer3_campaign_sync, db, campaign_id)
    except Exception as e:
        logger.exception("Layer3 start failed: %s", e)
        raise HTTPException(500, str(e)) from e
    return {"ok": True, "status": "completed", "layer3": stats}


@router.post("/{campaign_id}/pause")
async def post_pause_campaign(request: Request, campaign_id: str, body: PauseBody | None = None) -> Dict[str, Any]:
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    db.run_raw_query(
        "UPDATE screening_campaigns SET status = 'paused', updated_at = NOW() WHERE id::text = ?",
        [campaign_id],
    )
    return {"ok": True, "status": "paused"}


@router.post("/{campaign_id}/resume")
async def post_resume_campaign(request: Request, campaign_id: str) -> Dict[str, Any]:
    """Resume = re-run start (Layer 0) for now."""
    return await post_start_campaign(request, campaign_id)


@router.get("/{campaign_id}/candidates")
async def get_campaign_candidates(
    request: Request,
    campaign_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    selected_only: bool = Query(False, alias="selectedOnly"),
    include_enrichment: bool = Query(
        False,
        alias="includeEnrichment",
        description="Include latest public enrichment kinds + ai_profiles summary per row",
    ),
) -> Dict[str, Any]:
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    rows, total = list_candidates(
        db, campaign_id, limit=limit, offset=offset, selected_only=selected_only
    )
    if include_enrichment and rows:
        attach_public_enrichment_to_candidates(db, rows)
    out: List[Dict[str, Any]] = []
    for r in rows:
        def _jsonish(v: Any) -> Any:
            if v is None:
                return None
            if isinstance(v, dict):
                return v
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    return None
            return v

        rel_json = _jsonish(r.get("relevance_json"))
        fit_json = _jsonish(r.get("fit_json"))
        rel_conf = None
        reason_codes = None
        if isinstance(rel_json, dict):
            rel_conf = rel_json.get("relevance_confidence")
            if rel_conf is None:
                rel_conf = rel_json.get("confidence")
            reason_codes = rel_json.get("relevance_reason_codes")
            if reason_codes is None:
                rc = rel_json.get("reason_codes")
                reason_codes = rc if isinstance(rc, list) else None
        item: Dict[str, Any] = {
            "orgnr": str(r.get("orgnr", "")),
            "name": r.get("name"),
            "layer0Rank": r.get("layer0_rank"),
            "profileWeightedScore": float(r["profile_weighted_score"])
            if r.get("profile_weighted_score") is not None
            else None,
            "archetypeCode": r.get("archetype_code"),
            "isSelected": bool(r.get("is_selected")),
            "finalRank": r.get("final_rank"),
            "primaryNace": r.get("primary_nace"),
            "excludedFromAnalysis": bool(r.get("excluded_from_analysis")),
            "exclusionReason": r.get("exclusion_reason"),
            "relevanceStatus": r.get("relevance_status"),
            "relevanceConfidence": float(rel_conf) if rel_conf is not None else None,
            "relevanceReasonCodes": reason_codes,
            "relevanceJson": rel_json,
            "fitJson": fit_json,
            "fitTotal": float(r["fit_total"]) if r.get("fit_total") is not None else None,
            "combinedScore": float(r["combined_score"]) if r.get("combined_score") is not None else None,
        }
        if include_enrichment:
            item["enrichmentKinds"] = list(r.get("enrichmentKinds") or [])
            item["enrichmentSummary"] = r.get("enrichmentSummary")
            item["enrichmentStatus"] = r.get("enrichmentStatus")
        out.append(item)
    return {"rows": out, "total": total}


@router.patch("/{campaign_id}/candidates/{orgnr}")
async def patch_candidate_exclusion(
    request: Request,
    campaign_id: str,
    orgnr: str,
    body: CandidateExclusionBody,
) -> Dict[str, Any]:
    """Mark a candidate excluded from further analysis (e.g. head office, holding shell)."""
    _require_postgres()
    _require_user(request)
    db = get_database_service()
    row = get_campaign(db, campaign_id)
    if not row:
        raise HTTPException(404, "Campaign not found")
    ok = set_candidate_exclusion(
        db,
        campaign_id,
        orgnr,
        excluded=body.excluded_from_analysis,
        reason=body.exclusion_reason,
    )
    if not ok:
        raise HTTPException(404, "Candidate not found in this campaign")
    return {"ok": True, "orgnr": orgnr, "excludedFromAnalysis": body.excluded_from_analysis}
