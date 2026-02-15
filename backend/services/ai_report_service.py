"""
Canonical AI report builder and generator.

Cache-first: build from company_enrichment.
Fallback: generate via LLM and persist.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _is_stale(created_at: Any, max_age_days: int) -> bool:
    """True if created_at is older than max_age_days."""
    if not created_at or max_age_days <= 0:
        return False
    try:
        if isinstance(created_at, datetime):
            ts = created_at
        elif isinstance(created_at, str):
            ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            return False
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        return ts < cutoff
    except Exception:
        return False

# Canonical kinds; ai_analysis is legacy alias for llm_analysis
AI_REPORT_KINDS = ["ai_report", "llm_analysis", "ai_analysis", "company_profile", "website_insights", "about_summary"]


def _normalize_uplift_ops(val: Any) -> List[Dict[str, Any]]:
    if not val:
        return []
    if isinstance(val, list):
        out = []
        for item in val:
            if isinstance(item, dict):
                out.append({
                    "name": str(item.get("name", item)),
                    "impact": str(item.get("impact", "")),
                    "effort": str(item.get("effort", "Medium")),
                })
            else:
                out.append({"name": str(item), "impact": "", "effort": "Medium"})
        return out
    return [{"name": str(val), "impact": "", "effort": "Medium"}]


def build_ai_report_from_db(
    orgnr: str, db, include_extras: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Build AIReport from existing Postgres enrichment (cache-first).

    Priority: ai_report > llm_analysis > company_profile + website_insights fallbacks.
    Returns report dict (API shape) or None if insufficient data.
    If include_extras=True, adds ai_summary and run_id_by_kind when enrichment exists.
    """
    enrichment_by_kind = db.fetch_company_enrichment_single(
        orgnr, kinds=AI_REPORT_KINDS, latest_run_only=True
    )
    profiles = db.fetch_ai_profiles([orgnr])
    profile = profiles[0] if profiles else None

    def _add_extras(report: Dict[str, Any]) -> Dict[str, Any]:
        if not include_extras:
            return report
        enrichment = {k: v.get("result") for k, v in enrichment_by_kind.items() if v.get("result")}
        try:
            from .ai_summary_service import build_ai_summary
            report["ai_summary"] = build_ai_summary(orgnr, profile, enrichment)
        except Exception:
            report["ai_summary"] = {}
        report["run_id_by_kind"] = {
            k: str(v.get("run_id"))
            for k, v in enrichment_by_kind.items()
            if v.get("run_id")
        }
        return report

    # Optional staleness: reject cached report if older than AI_REPORT_MAX_AGE_DAYS
    max_age_days_raw = os.getenv("AI_REPORT_MAX_AGE_DAYS", "").strip()
    max_age_days = int(max_age_days_raw) if max_age_days_raw.isdigit() else 0

    # 1. Prefer kind=ai_report (stored report)
    ai_report_row = enrichment_by_kind.get("ai_report", {})
    ai_report_res = ai_report_row.get("result")
    if ai_report_res and isinstance(ai_report_res, dict):
        if max_age_days > 0 and _is_stale(ai_report_row.get("created_at"), max_age_days):
            pass  # treat as cache miss, fall through to generate
        else:
            return _add_extras(_report_dict_from_enrichment(orgnr, ai_report_res, profile))

    # 2. llm_analysis (or legacy ai_analysis) can produce full report
    llm_raw = enrichment_by_kind.get("llm_analysis") or enrichment_by_kind.get("ai_analysis")
    llm = (llm_raw or {}).get("result") if llm_raw else None
    if isinstance(llm, dict):
        analysis = llm.get("analysis", llm)
        if isinstance(analysis, dict) and (analysis.get("business_model") or analysis.get("weaknesses")):
            if max_age_days > 0 and _is_stale((llm_raw or {}).get("created_at"), max_age_days):
                pass  # treat as stale, fall through
            else:
                return _add_extras(_compose_from_llm_analysis(orgnr, analysis, profile))

    # 3. Fallback: company_profile + website_insights + ai_profile
    company_prof = enrichment_by_kind.get("company_profile", {}).get("result")
    website_ins = enrichment_by_kind.get("website_insights", {}).get("result")
    about = enrichment_by_kind.get("about_summary", {}).get("result")

    business_model = None
    weaknesses: List[str] = []
    uplift_ops: List[Dict[str, Any]] = []
    impact_range = "Medium"
    outreach_angle = None

    if isinstance(company_prof, dict) and company_prof.get("what_they_do"):
        business_model = company_prof.get("what_they_do")
    if isinstance(website_ins, dict):
        ins = website_ins.get("insights_json", website_ins)
        if isinstance(ins, dict):
            business_model = business_model or ins.get("what_they_do") or ins.get("summary")
            weaknesses = _as_list(ins.get("weaknesses"))
            uplift_ops = _normalize_uplift_ops(ins.get("uplift_ops"))
    if isinstance(about, dict) and about.get("about_text"):
        business_model = business_model or about.get("about_text")
    if profile:
        business_model = business_model or profile.get("business_model_summary") or profile.get("business_summary")
        weaknesses = weaknesses or _as_list(profile.get("risk_flags"))
        uplift_ops = uplift_ops or _normalize_uplift_ops(profile.get("next_steps"))
        outreach_angle = profile.get("acquisition_angle")

    if business_model or weaknesses or uplift_ops:
        report = {
            "orgnr": orgnr,
            "business_model": business_model or "",
            "weaknesses": weaknesses,
            "uplift_ops": uplift_ops,
            "impact_range": impact_range,
            "outreach_angle": outreach_angle,
        }
        return _add_extras(report)
    return None


def _as_list(val: Any) -> List[str]:
    if not val:
        return []
    if isinstance(val, list):
        return [str(x) for x in val]
    return [str(val)]


def _report_dict_from_enrichment(orgnr: str, res: Dict[str, Any], profile: Optional[Dict]) -> Dict[str, Any]:
    """Convert stored ai_report result to API shape."""
    return {
        "orgnr": orgnr,
        "business_model": res.get("business_model") or "",
        "weaknesses": _as_list(res.get("weaknesses")),
        "uplift_ops": _normalize_uplift_ops(res.get("uplift_ops")),
        "impact_range": res.get("impact_range") or "Medium",
        "outreach_angle": res.get("outreach_angle"),
    }


def _compose_from_llm_analysis(orgnr: str, analysis: Dict[str, Any], profile: Optional[Dict]) -> Dict[str, Any]:
    """Compose report from llm_analysis.analysis."""
    return {
        "orgnr": orgnr,
        "business_model": analysis.get("business_model") or analysis.get("what_they_do") or "",
        "weaknesses": _as_list(analysis.get("weaknesses")),
        "uplift_ops": _normalize_uplift_ops(analysis.get("uplift_ops")),
        "impact_range": analysis.get("impact_range") or "Medium",
        "outreach_angle": analysis.get("outreach_angle") or (profile.get("acquisition_angle") if profile else None),
    }


def generate_ai_report(orgnr: str, llm_provider, db=None) -> Dict[str, Any]:
    """
    Generate AI report via LLM provider (same prompts as AIReportGenerator).
    Returns report dict (API shape). db can be passed to avoid circular import.
    """
    if db is None:
        from ..services.db_factory import get_database_service
        db = get_database_service()
    rows = db.run_raw_query(
        """
        SELECT c.orgnr, c.company_id, c.company_name, c.segment_names, c.homepage, c.employees_latest,
               k.latest_revenue_sek, k.revenue_cagr_3y, k.avg_ebitda_margin, k.avg_net_margin
        FROM companies c
        LEFT JOIN company_kpis k ON k.orgnr = c.orgnr
        WHERE c.orgnr = ?
        """,
        [orgnr],
    )
    if not rows:
        raise ValueError(f"Company not found: {orgnr}")
    company_data = rows[0]
    profiles = db.fetch_ai_profiles([orgnr])
    intel_data = profiles[0] if profiles else None

    context = _build_context(company_data, intel_data)

    business_res = llm_provider.generate_json(
        system_prompt="You are a business analyst. Return JSON: {\"business_model\": \"2-3 paragraph summary\"}",
        user_prompt=f"Company context:\n{context}\n\nWrite business model summary.",
        model=None,
        temperature=0.3,
    )
    business_model = business_res.get("data", {}).get("business_model", "")

    weak_res = llm_provider.generate_json(
        system_prompt="You identify operational weaknesses. Return JSON: {\"weaknesses\": [\"string\", ...]}",
        user_prompt=f"Context:\n{context}\n\nIdentify 3-5 weaknesses. Return JSON array.",
        model=None,
        temperature=0.4,
    )
    weaknesses = _as_list(weak_res.get("data", {}).get("weaknesses"))

    uplift_res = llm_provider.generate_json(
        system_prompt="You assess uplift potential. Return JSON: {\"levers\": [{\"name\",\"impact\",\"effort\"}], \"impact_range\": \"Low|Medium|High\"}",
        user_prompt=f"Context:\n{context}\n\nIdentify 3-5 uplift levers with impact and effort.",
        model=None,
        temperature=0.4,
    )
    data = uplift_res.get("data", {})
    uplift_ops = _normalize_uplift_ops([{**x, "effort": x.get("effort", "Medium")} for x in (data.get("levers") or [])])
    impact_range = data.get("impact_range") or "Medium"

    outreach_res = llm_provider.generate_json(
        system_prompt="You write outreach angles. Return JSON: {\"outreach_angle\": \"2-3 sentences in Swedish\"}",
        user_prompt=f"Context:\n{context}\n\nBusiness: {business_model}\nWeaknesses: {weaknesses}\n\nCreate outreach angle for founder.",
        model=None,
        temperature=0.5,
    )
    outreach_angle = outreach_res.get("data", {}).get("outreach_angle", "")

    return {
        "orgnr": orgnr,
        "business_model": business_model,
        "weaknesses": weaknesses,
        "uplift_ops": uplift_ops,
        "impact_range": impact_range,
        "outreach_angle": outreach_angle,
    }


def _build_context(company_data: Dict, intel_data: Optional[Dict]) -> str:
    parts = [
        f"Company: {company_data.get('company_name', 'Unknown')}",
        f"Org: {company_data.get('orgnr', '')}",
    ]
    if company_data.get("segment_names"):
        parts.append(f"Segment: {company_data['segment_names']}")
    parts.append("\n### Financial")
    for k in ["latest_revenue_sek", "revenue_cagr_3y", "avg_ebitda_margin", "avg_net_margin", "employees_latest"]:
        v = company_data.get(k)
        if v is not None:
            parts.append(f"{k}: {v}")
    if intel_data:
        parts.append("\n### Intel")
        if intel_data.get("product_description"):
            parts.append(f"Product: {intel_data['product_description'][:500]}")
        if intel_data.get("industry_sector"):
            parts.append(f"Industry: {intel_data['industry_sector']}")
    return "\n".join(parts)


def persist_ai_report(db, orgnr: str, report: Dict[str, Any], run_id: str, meta: Optional[Dict] = None) -> None:
    """Persist report to company_enrichment kind=ai_report."""
    db.upsert_company_enrichment(
        orgnr=orgnr,
        run_id=run_id,
        kind="ai_report",
        result=report,
        score=None,
        tags=meta,
    )
