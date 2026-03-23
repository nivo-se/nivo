"""
Screening campaigns API: universe shortlist runs (Layer 0 deterministic + future stages).

See docs/deep_research/SCREENING_ORCHESTRATOR_SPEC.md
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..services.db_factory import get_database_service
from ..services.screening_orchestrator.campaign_service import (
    create_campaign,
    get_campaign,
    list_campaigns,
    list_candidates,
    run_layer0_sync,
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
    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "orgnr": str(r.get("orgnr", "")),
                "name": r.get("name"),
                "layer0Rank": r.get("layer0_rank"),
                "profileWeightedScore": float(r["profile_weighted_score"])
                if r.get("profile_weighted_score") is not None
                else None,
                "archetypeCode": r.get("archetype_code"),
                "isSelected": bool(r.get("is_selected")),
                "finalRank": r.get("final_rank"),
            }
        )
    return {"rows": out, "total": total}
