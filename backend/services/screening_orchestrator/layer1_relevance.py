"""Layer 1: LLM relevance gate (in_mandate / out_of_mandate / uncertain)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Set

from backend.llm.providers.openai_compat import OpenAICompatProvider
from backend.services.exemplar_mandate import mandate_text_for_prompt

logger = logging.getLogger(__name__)

BATCH_SIZE = 12


def _candidate_rows_for_layer1(db: Any, campaign_id: str) -> List[Dict[str, Any]]:
    rows = db.run_raw_query(
        """
        SELECT c.orgnr, c.layer0_rank, c.excluded_from_analysis,
               co.company_name AS name,
               (CASE WHEN co.nace_codes IS NULL THEN NULL ELSE (co.nace_codes::jsonb->>0) END) AS primary_nace
        FROM screening_campaign_candidates c
        LEFT JOIN companies co ON co.orgnr = c.orgnr
        WHERE c.campaign_id::text = ?
        ORDER BY c.layer0_rank ASC NULLS LAST, c.orgnr
        """,
        [campaign_id],
    )
    return [dict(r) for r in (rows or []) if not r.get("excluded_from_analysis")]


def _attach_ai_summaries(db: Any, rows: List[Dict[str, Any]]) -> None:
    fetch_ap = getattr(db, "fetch_ai_profiles", None)
    if not callable(fetch_ap):
        return
    orgnrs = [str(r.get("orgnr", "")).strip() for r in rows if r.get("orgnr")]
    if not orgnrs:
        return
    try:
        profiles = fetch_ap(orgnrs) or []
    except Exception as exc:
        logger.debug("fetch_ai_profiles for layer1: %s", exc)
        return
    by_org = {str(p.get("org_number")): p for p in profiles if p.get("org_number")}
    for r in rows:
        o = str(r.get("orgnr", "")).strip()
        prof = by_org.get(o)
        if not prof:
            continue
        raw = (prof.get("business_summary") or prof.get("business_model_summary") or "") or ""
        raw = str(raw).strip()
        if len(raw) > 400:
            raw = raw[:400] + "…"
        if raw:
            r["_ai_summary"] = raw


def _system_prompt(mandate_block: str) -> str:
    return f"""You are a buy-side screening analyst. For each company, decide if it is in the investment mandate.

Use ONLY the mandate JSON below plus the short company facts provided. Do not invent financial numbers.

Mandate (structured):
{mandate_block}

Respond with strict JSON only (no markdown). Schema:
{{"decisions": [{{"orgnr": "string", "status": "in_mandate"|"out_of_mandate"|"uncertain", "confidence": 0.0-1.0, "primary_business_summary": "one line", "reason_codes": ["short_code"]}}]}}

You MUST include one decision object per company in the user message (same orgnr values)."""


def _user_prompt(batch: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for r in batch:
        o = str(r.get("orgnr", ""))
        name = r.get("name") or ""
        nace = r.get("primary_nace") or ""
        extra = r.get("_ai_summary")
        parts = [f"- orgnr={o}", f"name={name}", f"primary_sni_nace={nace}"]
        if extra:
            parts.append(f"ai_summary={extra}")
        lines.append(" ".join(parts))
    return "Companies:\n" + "\n".join(lines)


def run_layer1_sync(db: Any, campaign_id: str) -> Dict[str, Any]:
    """
    Batched LLM relevance labels; updates relevance_status + relevance_json on candidates.
    """
    rows = _candidate_rows_for_layer1(db, campaign_id)
    if not rows:
        return {"processed": 0, "batches": 0, "message": "no_candidates"}

    _attach_ai_summaries(db, rows)
    mandate_block = mandate_text_for_prompt(max_chars=10000)
    provider = OpenAICompatProvider()
    sys_p = _system_prompt(mandate_block)

    total_written = 0
    batches = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        batches += 1
        expected: Set[str] = {str(r["orgnr"]).strip() for r in chunk}
        user_p = _user_prompt(chunk)
        try:
            out = provider.generate_json(sys_p, user_p, schema_hint=None, temperature=0.1)
        except Exception as exc:
            logger.exception("Layer1 LLM batch failed: %s", exc)
            raise
        data = (out or {}).get("data") if isinstance(out, dict) else {}
        if not isinstance(data, dict):
            data = {}
        raw_decisions = data.get("decisions")
        if not isinstance(raw_decisions, list):
            raw_decisions = []

        by_org: Dict[str, Dict[str, Any]] = {}
        for d in raw_decisions:
            if not isinstance(d, dict):
                continue
            org = str(d.get("orgnr", "")).strip()
            if org:
                by_org[org] = d

        for org in expected:
            d = by_org.get(org)
            if not d:
                status = "uncertain"
                payload = {
                    "orgnr": org,
                    "status": status,
                    "confidence": 0.0,
                    "primary_business_summary": "",
                    "reason_codes": ["layer1_missing_in_response"],
                }
            else:
                st = str(d.get("status", "uncertain")).strip()
                if st not in ("in_mandate", "out_of_mandate", "uncertain"):
                    st = "uncertain"
                payload = {
                    "orgnr": org,
                    "status": st,
                    "confidence": float(d.get("confidence") or 0.0),
                    "primary_business_summary": str(d.get("primary_business_summary") or "")[:2000],
                    "reason_codes": d.get("reason_codes")
                    if isinstance(d.get("reason_codes"), list)
                    else [],
                    "contradictions": d.get("contradictions"),
                    "evidence": d.get("evidence"),
                }
                status = st

            db.run_raw_query(
                """
                UPDATE screening_campaign_candidates
                SET relevance_status = ?,
                    relevance_json = ?::jsonb
                WHERE campaign_id::text = ? AND orgnr = ?
                """,
                [status, json.dumps(payload), campaign_id, org],
            )
            total_written += 1

    return {
        "processed": total_written,
        "batches": batches,
        "input_rows": len(rows),
    }
