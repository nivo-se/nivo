"""Layer 3: deterministic blend + final_rank + shortlist selection (no LLM)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Tuple

from backend.services.screening_orchestrator.policies import (
    relevance_eligible_for_shortlist,
    uncertain_relevance_mode,
)

logger = logging.getLogger(__name__)


def _norm_map(values: List[float]) -> Dict[int, float]:
    """Map index -> 0..1 by max in cohort (skip non-positive max)."""
    if not values:
        return {}
    mx = max(values)
    if mx <= 0:
        return {i: 0.0 for i in range(len(values))}
    return {i: values[i] / mx for i in range(len(values))}


def _final_shortlist_n(params: Dict[str, Any]) -> int:
    v = params.get("finalShortlistSize") or params.get("final_shortlist_size") or 100
    try:
        n = int(v)
    except (TypeError, ValueError):
        n = 100
    return max(1, min(n, 10_000))


def run_layer3_sync(db: Any, campaign_id: str) -> Dict[str, Any]:
    """
    combined_score = w_det * norm(profile_weighted_score) + w_fit * norm(fit_total)
    Missing fit_total uses profile term only.

    ``out_of_mandate`` and ``uncertain`` (when policy rejects uncertain) get combined_score 0.
    Sets ``is_selected`` for top ``finalShortlistSize`` eligible rows by combined score.
    """
    row = db.run_raw_query(
        "SELECT params_json FROM screening_campaigns WHERE id::text = ?",
        [campaign_id],
    )
    params: Dict[str, Any] = {}
    if row and row[0].get("params_json"):
        pj = row[0]["params_json"]
        if isinstance(pj, str):
            try:
                params = json.loads(pj)
            except json.JSONDecodeError:
                params = {}
        elif isinstance(pj, dict):
            params = dict(pj)

    sw = params.get("scoreWeights") or {}
    if not isinstance(sw, dict):
        sw = {}
    w_det = float(sw.get("deterministic", 0.4))
    w_fit = float(sw.get("fit", 0.6))
    s = w_det + w_fit
    if s <= 0:
        w_det, w_fit = 0.5, 0.5
    else:
        w_det, w_fit = w_det / s, w_fit / s

    u_mode = uncertain_relevance_mode(params)
    shortlist_n = _final_shortlist_n(params)

    rows = db.run_raw_query(
        """
        SELECT orgnr, profile_weighted_score, fit_total, relevance_status, excluded_from_analysis
        FROM screening_campaign_candidates
        WHERE campaign_id::text = ?
        ORDER BY orgnr
        """,
        [campaign_id],
    )
    raw_rows = [dict(r) for r in (rows or [])]
    active = [r for r in raw_rows if not r.get("excluded_from_analysis")]
    prof_vals = []
    fit_vals = []
    for r in active:
        try:
            p = float(r.get("profile_weighted_score") or 0.0)
        except (TypeError, ValueError):
            p = 0.0
        prof_vals.append(max(0.0, p))
        ft = r.get("fit_total")
        try:
            ftn = float(ft) if ft is not None else None
        except (TypeError, ValueError):
            ftn = None
        fit_vals.append(ftn if ftn is not None else 0.0)

    prof_norm = _norm_map(prof_vals)
    fit_norm = _norm_map(fit_vals)

    scored: List[Tuple[str, float]] = []
    for i, r in enumerate(active):
        org = str(r["orgnr"])
        rel = r.get("relevance_status") or ""
        if rel == "out_of_mandate":
            combined = 0.0
        elif rel == "uncertain" and u_mode == "reject":
            combined = 0.0
        else:
            pn = prof_norm.get(i, 0.0)
            fn = fit_norm.get(i, 0.0)
            has_fit = r.get("fit_total") is not None
            if has_fit:
                combined = w_det * pn + w_fit * fn
            else:
                combined = pn
        scored.append((org, combined))

    scored.sort(key=lambda x: x[1], reverse=True)
    rank_map = {org: idx + 1 for idx, (org, _) in enumerate(scored)}

    updated = 0
    for org, combined in scored:
        fr = rank_map.get(org)
        db.run_raw_query(
            """
            UPDATE screening_campaign_candidates
            SET combined_score = ?,
                final_rank = ?
            WHERE campaign_id::text = ? AND orgnr = ?
            """,
            [combined, fr, campaign_id, org],
        )
        updated += 1

    for r in raw_rows:
        if r.get("excluded_from_analysis"):
            org = str(r["orgnr"])
            db.run_raw_query(
                """
                UPDATE screening_campaign_candidates
                SET combined_score = 0,
                    final_rank = NULL,
                    is_selected = false
                WHERE campaign_id::text = ? AND orgnr = ?
                """,
                [campaign_id, org],
            )

    # Shortlist: top finalShortlistSize among relevance-eligible rows by combined_score
    eligible: List[Tuple[str, float]] = []
    score_by_org = {org: sc for org, sc in scored}
    for r in active:
        org = str(r["orgnr"])
        rel = r.get("relevance_status")
        if not relevance_eligible_for_shortlist(rel, params):
            continue
        eligible.append((org, float(score_by_org.get(org, 0.0))))

    eligible.sort(key=lambda x: x[1], reverse=True)
    selected = {org for org, _ in eligible[:shortlist_n]}

    db.run_raw_query(
        """
        UPDATE screening_campaign_candidates
        SET is_selected = false
        WHERE campaign_id::text = ?
        """,
        [campaign_id],
    )
    for org in selected:
        db.run_raw_query(
            """
            UPDATE screening_campaign_candidates
            SET is_selected = true
            WHERE campaign_id::text = ? AND orgnr = ?
            """,
            [campaign_id, org],
        )

    return {
        "ranked": updated,
        "weights": {"deterministic": w_det, "fit": w_fit},
        "scoreWeightsSource": "params_json.scoreWeights",
        "uncertainRelevance": u_mode,
        "finalShortlistSize": shortlist_n,
        "selected_count": len(selected),
    }
