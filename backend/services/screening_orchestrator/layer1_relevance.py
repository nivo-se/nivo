"""Layer 1: LLM relevance gate (in_mandate / out_of_mandate / uncertain), batched + persisted."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Set

from backend.llm.providers.openai_compat import OpenAICompatProvider
from backend.services.exemplar_mandate import mandate_text_for_prompt
from backend.services.screening_orchestrator.policies import layer1_web_retrieval_enabled
from backend.services.web_intel.screening_retrieval import fetch_screening_evidence_refs

logger = logging.getLogger(__name__)

BATCH_SIZE = 16


def _load_campaign_params(db: Any, campaign_id: str) -> Dict[str, Any]:
    rows = db.run_raw_query(
        "SELECT params_json FROM screening_campaigns WHERE id::text = ?",
        [campaign_id],
    )
    if not rows:
        return {}
    pj = rows[0].get("params_json")
    if isinstance(pj, dict):
        return dict(pj)
    if isinstance(pj, str):
        try:
            return dict(json.loads(pj))
        except json.JSONDecodeError:
            return {}
    return {}


def _layer1_limit(params: Dict[str, Any]) -> int:
    v = params.get("layer1Limit", params.get("layer1_limit", 800))
    try:
        n = int(v)
    except (TypeError, ValueError):
        n = 800
    return max(1, min(n, 50_000))


def _candidate_rows_for_layer1(db: Any, campaign_id: str, limit: int) -> List[Dict[str, Any]]:
    rows = db.run_raw_query(
        """
        SELECT c.orgnr, c.layer0_rank, c.excluded_from_analysis,
               co.company_name AS name,
               co.homepage,
               (CASE WHEN co.nace_codes IS NULL THEN NULL ELSE (co.nace_codes::jsonb->>0) END) AS primary_nace
        FROM screening_campaign_candidates c
        LEFT JOIN companies co ON co.orgnr = c.orgnr
        WHERE c.campaign_id::text = ?
        ORDER BY c.layer0_rank ASC NULLS LAST, c.orgnr
        LIMIT ?
        """,
        [campaign_id, limit],
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


def _attach_evidence_refs(params: Dict[str, Any], rows: List[Dict[str, Any]]) -> None:
    if not layer1_web_retrieval_enabled(params):
        return
    for r in rows:
        refs = fetch_screening_evidence_refs(
            company_name=str(r.get("name") or ""),
            orgnr=str(r.get("orgnr") or ""),
            homepage=str(r.get("homepage") or "").strip() or None,
            max_queries=2,
            max_refs=8,
        )
        if refs:
            r["_evidence_refs"] = refs


def _system_prompt(mandate_block: str, *, has_web_evidence: bool) -> str:
    ev = (
        "\nSome companies include short web search snippets (URLs + text) for context; "
        "treat them as weak hints, not financial facts.\n"
        if has_web_evidence
        else "\n"
    )
    return f"""You are a buy-side screening analyst. For each company, decide if it is in the investment mandate.

Use ONLY the mandate JSON below plus the short company facts provided. Do not invent financial numbers.{ev}
Mandate (structured):
{mandate_block}

Respond with strict JSON only (no markdown). Schema:
{{"decisions": [{{"orgnr": "string", "status": "in_mandate"|"out_of_mandate"|"uncertain", "confidence": 0.0-1.0, "primary_business_summary": "one line", "reason_codes": ["short_code"], "contradictions": null|string, "evidence": [{{"url": "string", "title": "string", "support_strength": "strong"|"weak"}}]}}]}}

You MUST include one decision object per company in the user message (same orgnr values)."""


def _user_prompt(batch: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for r in batch:
        o = str(r.get("orgnr", ""))
        name = r.get("name") or ""
        nace = r.get("primary_nace") or ""
        parts = [f"- orgnr={o}", f"name={name}", f"primary_sni_nace={nace}"]
        extra = r.get("_ai_summary")
        if extra:
            parts.append(f"ai_summary={extra}")
        refs = r.get("_evidence_refs")
        if isinstance(refs, list) and refs:
            snips = []
            for ref in refs[:6]:
                if not isinstance(ref, dict):
                    continue
                snips.append(
                    f"[{ref.get('title') or ref.get('url')}] {(ref.get('snippet') or '')[:320]}"
                )
            if snips:
                parts.append("web_snippets=" + " | ".join(snips))
        lines.append(" ".join(parts))
    return "Companies:\n" + "\n".join(lines)


def _normalize_payload(
    org: str,
    d: Dict[str, Any] | None,
    *,
    fallback_reason: str,
    evidence_refs: List[Dict[str, Any]] | None,
) -> tuple[str, Dict[str, Any]]:
    if not d:
        status = "uncertain"
        payload: Dict[str, Any] = {
            "orgnr": org,
            "status": status,
            "confidence": 0.0,
            "primary_business_summary": "",
            "reason_codes": [fallback_reason],
            "contradictions": None,
            "evidence": [],
            "evidence_refs": evidence_refs or [],
        }
        return status, payload

    st = str(d.get("status", "uncertain")).strip()
    if st not in ("in_mandate", "out_of_mandate", "uncertain"):
        st = "uncertain"
    reason_codes = d.get("reason_codes") if isinstance(d.get("reason_codes"), list) else []
    ev_llm = d.get("evidence") if isinstance(d.get("evidence"), list) else []
    refs_out = list(evidence_refs or [])
    # Merge LLM evidence URLs with retrieval refs for audit
    merged_evidence = []
    for x in ev_llm:
        if isinstance(x, dict) and (x.get("url") or x.get("title")):
            merged_evidence.append(
                {
                    "url": str(x.get("url") or "")[:2000],
                    "title": str(x.get("title") or "")[:500],
                    "support_strength": str(x.get("support_strength") or "weak"),
                }
            )
    payload = {
        "orgnr": org,
        "status": st,
        "confidence": float(d.get("confidence") or 0.0),
        "primary_business_summary": str(d.get("primary_business_summary") or "")[:2000],
        "reason_codes": [str(c)[:200] for c in reason_codes][:50],
        "contradictions": d.get("contradictions"),
        "evidence": merged_evidence[:20],
        "evidence_refs": refs_out[:20],
        "relevance_confidence": float(d.get("confidence") or 0.0),
        "relevance_reason_codes": [str(c)[:200] for c in reason_codes][:50],
    }
    return st, payload


def run_layer1_sync(db: Any, campaign_id: str) -> Dict[str, Any]:
    """
    Batched LLM relevance labels; updates relevance_status + relevance_json on candidates.

    Honors ``layer1Limit`` and optional ``policy.layer1WebRetrieval`` / Tavily snippets.
    """
    params = _load_campaign_params(db, campaign_id)
    lim = _layer1_limit(params)
    rows = _candidate_rows_for_layer1(db, campaign_id, lim)
    if not rows:
        return {"processed": 0, "batches": 0, "message": "no_candidates", "layer1_limit": lim}

    _attach_ai_summaries(db, rows)
    _attach_evidence_refs(params, rows)

    mandate_block = mandate_text_for_prompt(max_chars=10000)
    provider = OpenAICompatProvider()

    total_written = 0
    batches = 0
    batch_stats: List[Dict[str, Any]] = []

    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        batches += 1
        expected: Set[str] = {str(r["orgnr"]).strip() for r in chunk}
        has_web = any(isinstance(r.get("_evidence_refs"), list) and r.get("_evidence_refs") for r in chunk)
        sys_p = _system_prompt(mandate_block, has_web_evidence=has_web)
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

        refs_by_org = {
            str(r.get("orgnr", "")).strip(): (r.get("_evidence_refs") if isinstance(r.get("_evidence_refs"), list) else [])
            for r in chunk
        }

        for org in expected:
            d = by_org.get(org)
            status, payload = _normalize_payload(
                org,
                d,
                fallback_reason="layer1_missing_in_response",
                evidence_refs=refs_by_org.get(org) if isinstance(refs_by_org.get(org), list) else [],
            )
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

        batch_stats.append(
            {
                "batch_index": batches - 1,
                "size": len(chunk),
                "had_web_evidence": has_web,
            }
        )

    return {
        "processed": total_written,
        "batches": batches,
        "input_rows": len(rows),
        "layer1_limit": lim,
        "layer1_web_retrieval": layer1_web_retrieval_enabled(params),
        "batch_stats": batch_stats,
    }
