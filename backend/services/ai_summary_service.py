"""
Canonical AI summary builder.

Merges ai_profiles + company_enrichment into a stable summary object
for frontend consumption.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


def _as_list(val: Any) -> List[Any]:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]


def _as_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _normalize_uplift_ops(val: Any) -> List[Dict[str, Any]]:
    """Ensure uplift_ops is list of {name, impact, effort}."""
    if not val:
        return []
    if isinstance(val, list):
        out = []
        for item in val:
            if isinstance(item, dict):
                out.append({
                    "name": item.get("name", str(item)),
                    "impact": item.get("impact", ""),
                    "effort": item.get("effort", "Medium"),
                })
            else:
                out.append({"name": str(item), "impact": "", "effort": "Medium"})
        return out
    return [{"name": str(val), "impact": "", "effort": "Medium"}]


def build_ai_summary(
    orgnr: str,
    ai_profile: Optional[Dict[str, Any]],
    enrichment: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build a canonical AI summary from ai_profile and enrichment by kind.

    Prefer llm_analysis.analysis when present, fall back to company_profile,
    website_insights, about_summary, then ai_profile.

    Output keys: what_they_do, business_model, customers, strengths[],
    weaknesses[], uplift_ops[], red_flags[], fit_score, source_flags.
    """
    # Canonical kind is llm_analysis; accept ai_analysis as alias for backward compat
    llm = enrichment.get("llm_analysis") or enrichment.get("ai_analysis") or {}
    company_prof = enrichment.get("company_profile") or {}
    website_ins = enrichment.get("website_insights") or {}
    about = enrichment.get("about_summary") or {}

    analysis = llm.get("analysis") if isinstance(llm, dict) else {}
    if not isinstance(analysis, dict):
        analysis = {}

    source_flags: List[str] = []
    what_they_do = None
    business_model = None
    customers = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    uplift_ops: List[Dict[str, Any]] = []
    red_flags: List[str] = []
    fit_score: Optional[int] = None

    # 1. Prefer llm_analysis.analysis
    if analysis:
        source_flags.append("llm_analysis")
        what_they_do = _as_str(analysis.get("business_model") or analysis.get("what_they_do") or analysis.get("summary"))
        business_model = business_model or _as_str(analysis.get("business_model"))
        customers = customers or _as_str(analysis.get("customer_types") or analysis.get("customers"))
        strengths = _as_list(analysis.get("strengths")) or strengths
        weaknesses = _as_list(analysis.get("weaknesses")) or weaknesses
        uplift_ops = _normalize_uplift_ops(analysis.get("uplift_ops")) or uplift_ops
        red_flags = _as_list(analysis.get("risk_flags") or analysis.get("red_flags")) or red_flags
        fit_score = analysis.get("strategic_fit_score") or analysis.get("fit_score") if fit_score is None else fit_score

    # 2. company_profile
    if isinstance(company_prof, dict) and company_prof.get("what_they_do"):
        if "company_profile" not in source_flags:
            source_flags.append("company_profile")
        what_they_do = what_they_do or _as_str(company_prof.get("what_they_do"))
        business_model = business_model or what_they_do
        customers = customers or _as_str(company_prof.get("customer_type"))

    # 3. website_insights (often has insights_json)
    if isinstance(website_ins, dict) and website_ins:
        if "website_insights" not in source_flags:
            source_flags.append("website_insights")
        ins = website_ins.get("insights_json") if isinstance(website_ins.get("insights_json"), dict) else website_ins
        if isinstance(ins, dict):
            what_they_do = what_they_do or _as_str(ins.get("what_they_do") or ins.get("summary"))
            business_model = business_model or _as_str(ins.get("business_model"))
            weaknesses = weaknesses or _as_list(ins.get("weaknesses"))
            uplift_ops = uplift_ops or _normalize_uplift_ops(ins.get("uplift_ops"))

    # 4. about_summary (about_text, services_text, hero_text)
    if isinstance(about, dict) and about:
        if "about_summary" not in source_flags:
            source_flags.append("about_summary")
        combined = " ".join(filter(None, [
            _as_str(about.get("about_text")),
            _as_str(about.get("services_text")),
            _as_str(about.get("hero_text")),
        ]))
        what_they_do = what_they_do or (combined[:2000] if combined else None)
        business_model = business_model or _as_str(about.get("about_text"))

    # 5. ai_profile fallback
    if ai_profile:
        if "ai_profile" not in source_flags:
            source_flags.append("ai_profile")
        what_they_do = what_they_do or _as_str(ai_profile.get("business_summary") or ai_profile.get("product_description") or ai_profile.get("business_model_summary"))
        business_model = business_model or _as_str(ai_profile.get("business_model_summary") or ai_profile.get("business_summary"))
        customers = customers or _as_str(ai_profile.get("customer_types"))
        weaknesses = weaknesses or _as_list(ai_profile.get("risk_flags"))
        uplift_ops = uplift_ops or _normalize_uplift_ops(ai_profile.get("next_steps"))
        red_flags = red_flags or _as_list(ai_profile.get("risk_flags"))
        fit_score = fit_score if fit_score is not None else ai_profile.get("strategic_fit_score")

    return {
        "what_they_do": what_they_do,
        "business_model": business_model,
        "customers": customers,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "uplift_ops": uplift_ops,
        "red_flags": red_flags,
        "fit_score": fit_score,
        "source_flags": source_flags,
    }
