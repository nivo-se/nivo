"""CRUD and Layer 0 execution for screening campaigns."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.api.universe import _get_profile_config
from backend.services.screening_orchestrator.layer0 import run_layer0_for_campaign
from backend.services.screening_orchestrator.schemas import CreateCampaignBody

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mandate_hash(config_snapshot: Dict[str, Any], params_json: Dict[str, Any]) -> str:
    payload = json.dumps(
        {"config": config_snapshot, "params": params_json},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:40]


def resolve_profile_version_id(db: Any, profile_id: str, version_id: Optional[str]) -> Optional[str]:
    if version_id:
        return version_id
    rows = db.run_raw_query(
        "SELECT id::text AS id FROM screening_profile_versions WHERE profile_id::text = ? AND is_active = true LIMIT 1",
        [profile_id],
    )
    return str(rows[0]["id"]) if rows else None


def fetch_profile_snapshot(db: Any, profile_id: str, version_id: Optional[str]) -> Dict[str, Any]:
    cfg = _get_profile_config(db, profile_id, version_id)
    return dict(cfg) if isinstance(cfg, dict) else {}


def create_campaign(db: Any, body: CreateCampaignBody, user_id: str) -> str:
    params_json = body.params.model_dump(by_alias=True)
    params_json["filters"] = [f.model_dump() for f in body.filters]
    params_json["excludeFilters"] = [f.model_dump() for f in body.exclude_filters]
    params_json["q"] = body.q
    params_json["overrides"] = dict(body.overrides)

    vid = resolve_profile_version_id(db, body.profile_id, body.profile_version_id)
    snapshot = fetch_profile_snapshot(db, body.profile_id, vid)
    mh = _mandate_hash(snapshot, params_json)

    cid = str(uuid4())
    db.run_raw_query(
        """
        INSERT INTO screening_campaigns (
            id, name, profile_id, profile_version_id, status,
            config_snapshot_json, params_json, mandate_hash, created_by_user_id,
            created_at, updated_at, stats_json
        )
        VALUES (
            ?::uuid, ?, ?::uuid, ?, 'draft',
            ?::jsonb, ?::jsonb, ?, ?,
            NOW(), NOW(), '{}'::jsonb
        )
        """,
        [
            cid,
            body.name,
            body.profile_id,
            vid,
            json.dumps(snapshot, default=str),
            json.dumps(params_json, default=str),
            mh,
            user_id,
        ],
    )
    return cid


def get_campaign(db: Any, campaign_id: str) -> Optional[Dict[str, Any]]:
    rows = db.run_raw_query(
        """
        SELECT id::text AS id, name, profile_id::text AS profile_id,
               profile_version_id::text AS profile_version_id, status,
               config_snapshot_json, params_json, mandate_hash,
               created_by_user_id, created_at, updated_at,
               error_message, current_stage, stats_json
        FROM screening_campaigns
        WHERE id::text = ?
        """,
        [campaign_id],
    )
    return rows[0] if rows else None


def list_campaigns(db: Any, limit: int = 50) -> List[Dict[str, Any]]:
    return db.run_raw_query(
        """
        SELECT id::text AS id, name, profile_id::text AS profile_id,
               profile_version_id::text AS profile_version_id, status,
               current_stage, stats_json, error_message, created_at, updated_at
        FROM screening_campaigns
        ORDER BY created_at DESC
        LIMIT ?
        """,
        [limit],
    )


def _upsert_stage(
    db: Any,
    campaign_id: str,
    stage: str,
    status: str,
    stats: Optional[Dict[str, Any]] = None,
    err: Optional[str] = None,
) -> None:
    stats = stats or {}
    rows = db.run_raw_query(
        "SELECT id::text FROM screening_campaign_stages WHERE campaign_id::text = ? AND stage = ?",
        [campaign_id, stage],
    )
    if rows:
        db.run_raw_query(
            """
            UPDATE screening_campaign_stages
            SET status = ?, finished_at = CASE WHEN ? IN ('completed', 'failed') THEN NOW() ELSE finished_at END,
                stats_json = ?::jsonb, error_message = ?
            WHERE campaign_id::text = ? AND stage = ?
            """,
            [status, status, json.dumps(stats), err, campaign_id, stage],
        )
    else:
        sid = str(uuid4())
        db.run_raw_query(
            """
            INSERT INTO screening_campaign_stages (id, campaign_id, stage, status, started_at, stats_json, error_message)
            VALUES (?::uuid, ?::uuid, ?, ?, NOW(), ?::jsonb, ?)
            """,
            [sid, campaign_id, stage, status, json.dumps(stats), err],
        )


def run_layer0_sync(db: Any, campaign_id: str) -> Dict[str, Any]:
    """Execute Layer 0: replace candidates, update campaign + stage. Caller holds transaction expectations per DB service."""
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        raise ValueError("Campaign not found")

    db.run_raw_query(
        "UPDATE screening_campaigns SET status = 'running', error_message = NULL, updated_at = NOW() WHERE id::text = ?",
        [campaign_id],
    )
    _upsert_stage(db, campaign_id, "layer0", "running", {})

    try:
        top, stats = run_layer0_for_campaign(db, campaign)

        db.run_raw_query(
            "DELETE FROM screening_campaign_candidates WHERE campaign_id::text = ?",
            [campaign_id],
        )

        for i, row in enumerate(top):
            db.run_raw_query(
                """
                INSERT INTO screening_campaign_candidates
                (campaign_id, orgnr, layer0_rank, profile_weighted_score, archetype_code)
                VALUES (?::uuid, ?, ?, ?, ?)
                """,
                [
                    campaign_id,
                    str(row.get("orgnr", "")),
                    i + 1,
                    row.get("profile_weighted_score"),
                    row.get("archetype_code"),
                ],
            )

        merged_stats = {**(campaign.get("stats_json") or {}), "layer0": stats}
        if isinstance(merged_stats, str):
            merged_stats = json.loads(merged_stats)

        db.run_raw_query(
            """
            UPDATE screening_campaigns
            SET status = 'completed', current_stage = 'layer0', stats_json = ?::jsonb,
                updated_at = NOW(), error_message = NULL
            WHERE id::text = ?
            """,
            [json.dumps(merged_stats), campaign_id],
        )
        _upsert_stage(db, campaign_id, "layer0", "completed", stats)
        return stats
    except Exception as e:
        logger.exception("Layer0 failed for campaign %s", campaign_id)
        db.run_raw_query(
            "UPDATE screening_campaigns SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id::text = ?",
            [str(e)[:2000], campaign_id],
        )
        _upsert_stage(db, campaign_id, "layer0", "failed", {}, str(e)[:2000])
        raise


def list_candidates(
    db: Any,
    campaign_id: str,
    *,
    limit: int = 100,
    offset: int = 0,
    selected_only: bool = False,
) -> tuple[List[Dict[str, Any]], int]:
    sel = " AND is_selected = true" if selected_only else ""
    total_rows = db.run_raw_query(
        f"SELECT COUNT(*)::int AS n FROM screening_campaign_candidates WHERE campaign_id::text = ?{sel}",
        [campaign_id],
    )
    total = int(total_rows[0]["n"]) if total_rows else 0
    rows = db.run_raw_query(
        f"""
        SELECT c.orgnr, c.layer0_rank, c.profile_weighted_score, c.archetype_code,
               c.is_selected, c.final_rank, c.excluded_from_analysis, c.exclusion_reason,
               co.company_name AS name,
               (CASE WHEN co.nace_codes IS NULL THEN NULL ELSE (co.nace_codes::jsonb->>0) END) AS primary_nace
        FROM screening_campaign_candidates c
        LEFT JOIN companies co ON co.orgnr = c.orgnr
        WHERE c.campaign_id::text = ?{sel}
        ORDER BY c.layer0_rank ASC NULLS LAST, c.orgnr
        LIMIT ? OFFSET ?
        """,
        [campaign_id, limit, offset],
    )
    return rows, total


def delete_campaign_record(db: Any, campaign_id: str) -> bool:
    """Delete a screening campaign. Candidates and stages CASCADE."""
    rows = db.run_raw_query(
        "DELETE FROM screening_campaigns WHERE id::text = ? RETURNING id",
        [campaign_id],
    )
    return bool(rows)


def attach_public_enrichment_to_candidates(db: Any, rows: List[Dict[str, Any]]) -> None:
    """
    Mutate candidate rows in place with enrichmentKinds, enrichmentSummary, enrichmentStatus
    from company_enrichment + ai_profiles (latest rows).
    """
    if not rows:
        return
    fetch_ce = getattr(db, "fetch_company_enrichment", None)
    fetch_ap = getattr(db, "fetch_ai_profiles", None)
    if not callable(fetch_ce) and not callable(fetch_ap):
        return
    orgnrs = [str(r.get("orgnr", "")).strip() for r in rows if r.get("orgnr")]
    if not orgnrs:
        return
    enrich_by_org: Dict[str, Dict[str, Dict[str, Any]]] = {}
    try:
        if callable(fetch_ce):
            enrich_by_org = fetch_ce(orgnrs, latest_run_only=True) or {}
    except Exception as exc:
        logger.debug("fetch_company_enrichment for candidates failed: %s", exc)
    profiles: List[Dict[str, Any]] = []
    try:
        if callable(fetch_ap):
            profiles = fetch_ap(orgnrs) or []
    except Exception as exc:
        logger.debug("fetch_ai_profiles for candidates failed: %s", exc)
    prof_by_org = {str(p.get("org_number")): p for p in profiles if p.get("org_number")}

    for r in rows:
        o = str(r.get("orgnr", "")).strip()
        kinds = list(enrich_by_org.get(o, {}).keys()) if enrich_by_org else []
        prof = prof_by_org.get(o)
        summary: Optional[str] = None
        status: Optional[str] = None
        if prof:
            raw = (prof.get("business_summary") or prof.get("business_model_summary") or "") or ""
            raw = str(raw).strip()
            if len(raw) > 220:
                raw = raw[:220] + "…"
            summary = raw or None
            status = prof.get("enrichment_status")
        r["enrichmentKinds"] = kinds
        r["enrichmentSummary"] = summary
        r["enrichmentStatus"] = status


def set_candidate_exclusion(
    db: Any,
    campaign_id: str,
    orgnr: str,
    *,
    excluded: bool,
    reason: Optional[str] = None,
) -> bool:
    """Set excluded_from_analysis for a campaign candidate row."""
    reason_val = (reason or "").strip() or None if excluded else None
    rows = db.run_raw_query(
        """
        UPDATE screening_campaign_candidates
        SET excluded_from_analysis = ?,
            exclusion_reason = ?
        WHERE campaign_id::text = ? AND orgnr = ?
        RETURNING orgnr
        """,
        [excluded, reason_val, campaign_id, orgnr],
    )
    return bool(rows)


__all__ = [
    "create_campaign",
    "delete_campaign_record",
    "get_campaign",
    "list_campaigns",
    "run_layer0_sync",
    "list_candidates",
    "resolve_profile_version_id",
    "attach_public_enrichment_to_candidates",
    "set_candidate_exclusion",
]
