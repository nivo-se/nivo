"""Layer 2: LLM fit scorecard on Layer-1 passes (in_mandate / uncertain)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Set

from backend.llm.providers.openai_compat import OpenAICompatProvider
from backend.services.exemplar_mandate import mandate_text_for_prompt

logger = logging.getLogger(__name__)

BATCH_SIZE = 8


def _candidates_for_layer2(db: Any, campaign_id: str) -> List[Dict[str, Any]]:
    rows = db.run_raw_query(
        """
        SELECT c.orgnr, c.layer0_rank, c.profile_weighted_score,
               c.relevance_status, c.relevance_json,
               co.company_name AS name,
               (CASE WHEN co.nace_codes IS NULL THEN NULL ELSE (co.nace_codes::jsonb->>0) END) AS primary_nace
        FROM screening_campaign_candidates c
        LEFT JOIN companies co ON co.orgnr = c.orgnr
        WHERE c.campaign_id::text = ?
          AND c.excluded_from_analysis = false
          AND c.relevance_status IN ('in_mandate', 'uncertain')
        ORDER BY c.layer0_rank ASC NULLS LAST, c.orgnr
        """,
        [campaign_id],
    )
    return [dict(r) for r in (rows or [])]


def _system_prompt(mandate_block: str) -> str:
    return f"""You score private-company fit for a buy-side mandate. Use only the facts given; do not invent financials.

Mandate context:
{mandate_block}

Return strict JSON only. For each company, output one object in "scores" with:
- orgnr (string)
- strategic_fit, financial_quality, value_creation_potential, complexity_risk, overall_fit: numbers 0-100
- headline: short string
- kill_switch: boolean (true if clearly uninvestable under mandate)
- notes: optional string

financial_quality must reflect data quality / plausibility of provided hints only, not invented metrics."""


def _user_prompt(batch: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for r in batch:
        o = str(r.get("orgnr", ""))
        rel = r.get("relevance_json")
        if isinstance(rel, str):
            try:
                rel = json.loads(rel)
            except json.JSONDecodeError:
                rel = {}
        elif rel is None:
            rel = {}
        summ = ""
        if isinstance(rel, dict):
            summ = str(rel.get("primary_business_summary") or "")
        line = (
            f"- orgnr={o} name={r.get('name') or ''} sni={r.get('primary_nace') or ''} "
            f"profile_score={r.get('profile_weighted_score')} relevance={r.get('relevance_status')} "
            f"summary={summ[:500]}"
        )
        lines.append(line)
    return "Companies:\n" + "\n".join(lines)


def run_layer2_sync(db: Any, campaign_id: str) -> Dict[str, Any]:
    rows = _candidates_for_layer2(db, campaign_id)
    if not rows:
        return {"processed": 0, "batches": 0, "message": "no_layer2_candidates"}

    mandate_block = mandate_text_for_prompt(max_chars=8000)
    provider = OpenAICompatProvider()
    sys_p = _system_prompt(mandate_block)
    total_written = 0
    batches = 0

    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        batches += 1
        expected: Set[str] = {str(r["orgnr"]).strip() for r in chunk}
        out = provider.generate_json(sys_p, _user_prompt(chunk), schema_hint=None, temperature=0.15)
        data = (out or {}).get("data") if isinstance(out, dict) else {}
        if not isinstance(data, dict):
            data = {}
        scores = data.get("scores")
        if not isinstance(scores, list):
            scores = []

        by_org: Dict[str, Dict[str, Any]] = {}
        for s in scores:
            if isinstance(s, dict) and s.get("orgnr"):
                by_org[str(s["orgnr"]).strip()] = s

        for org in expected:
            s = by_org.get(org)
            if not s:
                fit_payload = {
                    "orgnr": org,
                    "strategic_fit": 0,
                    "financial_quality": 0,
                    "value_creation_potential": 0,
                    "complexity_risk": 100,
                    "overall_fit": 0,
                    "headline": "Layer 2 response missing",
                    "kill_switch": True,
                    "notes": "layer2_missing_in_response",
                }
                fit_total = 0.0
            else:
                def _n(key: str, default: float = 0.0) -> float:
                    try:
                        v = float(s.get(key, default))
                    except (TypeError, ValueError):
                        return default
                    return max(0.0, min(100.0, v))

                fit_total = _n("overall_fit")
                fit_payload = {
                    "orgnr": org,
                    "strategic_fit": _n("strategic_fit"),
                    "financial_quality": _n("financial_quality"),
                    "value_creation_potential": _n("value_creation_potential"),
                    "complexity_risk": _n("complexity_risk"),
                    "overall_fit": fit_total,
                    "headline": str(s.get("headline") or "")[:500],
                    "kill_switch": bool(s.get("kill_switch")),
                    "notes": str(s.get("notes") or "")[:2000],
                }

            db.run_raw_query(
                """
                UPDATE screening_campaign_candidates
                SET fit_json = ?::jsonb,
                    fit_total = ?
                WHERE campaign_id::text = ? AND orgnr = ?
                """,
                [json.dumps(fit_payload), fit_total, campaign_id, org],
            )
            total_written += 1

    return {"processed": total_written, "batches": batches, "input_rows": len(rows)}
