"""Layer 0: deterministic universe query + profile-weighted rank (same logic as /api/universe/query)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

from backend.api.universe import (
    FilterItem,
    UniverseQueryPayload,
    execute_universe_query,
)

logger = logging.getLogger(__name__)


def _sort_key_profile_score(row: Dict[str, Any]) -> float:
    s = row.get("profile_weighted_score")
    if s is None:
        return float("-inf")
    try:
        return float(s)
    except (TypeError, ValueError):
        return float("-inf")


def run_layer0_for_campaign(db: Any, campaign: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Load params from campaign row, run full-universe query (no SQL LIMIT), sort by
    profile_weighted_score DESC, return top layer0_limit rows.

    Returns (top_rows, stats) where stats includes total_matched, layer0_limit, kept.
    """
    params = campaign.get("params_json") or {}
    if isinstance(params, str):
        import json

        params = json.loads(params)

    layer0_limit = int(params.get("layer0Limit", 20))

    raw_filters = params.get("filters") or []
    raw_excl = params.get("excludeFilters") or []

    filters: List[FilterItem] = []
    for f in raw_filters:
        if isinstance(f, dict):
            filters.append(FilterItem(**f))

    exclude_filters: List[FilterItem] = []
    for f in raw_excl:
        if isinstance(f, dict):
            exclude_filters.append(FilterItem(**f))

    profile_id = str(campaign.get("profile_id", ""))
    pv = campaign.get("profile_version_id")
    profile_version_id = str(pv) if pv else None

    body = UniverseQueryPayload(
        filters=filters,
        excludeFilters=exclude_filters or None,
        profileId=profile_id,
        profileVersionId=profile_version_id,
        q=params.get("q"),
        sort={"by": "orgnr", "dir": "asc"},
        limit=50,
        offset=0,
    )

    rows, total, _profile_cfg = execute_universe_query(
        db,
        body,
        max_rows=None,
        offset=0,
        stable_order_for_bulk=True,
    )

    ranked = sorted(rows, key=_sort_key_profile_score, reverse=True)
    top = ranked[:layer0_limit]

    stats = {
        "total_matched": total,
        "layer0_limit": layer0_limit,
        "kept": len(top),
        "scanned_rows": len(rows),
    }
    logger.info(
        "Layer0 campaign=%s total=%s scanned=%s kept=%s",
        campaign.get("id"),
        total,
        len(rows),
        len(top),
    )
    return top, stats
