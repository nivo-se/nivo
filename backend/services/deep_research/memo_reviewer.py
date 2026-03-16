"""Memo reviewer: quality check on composed report per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 8."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class MemoReviewResult:
    approved: bool
    issues: list[str] = field(default_factory=list)
    recommended_changes: list[str] = field(default_factory=list)


def run_memo_review(
    report_sections: dict,
    completeness_report: dict,
    stage_evaluations: dict,
    report_degraded: bool,
    degraded_reasons: list[str],
) -> MemoReviewResult:
    """
    Review composed report for quality. Returns approved, issues, recommended_changes.
    Uses completeness and stage evaluations; no LLM call.
    """
    issues: list[str] = []
    recommended: list[str] = []

    blocking = completeness_report.get("blocking_issues", [])
    if blocking:
        issues.extend(blocking[:5])
        recommended.append("Address blocking issues before finalizing")

    if report_degraded and degraded_reasons:
        issues.append(f"Pipeline degraded: {', '.join(degraded_reasons[:3])}")
        recommended.append("Review degraded stages and consider re-run")

    failed_stages = [
        name for name, ev in stage_evaluations.items()
        if isinstance(ev, dict) and ev.get("status") == "fail"
    ]
    if failed_stages:
        issues.append(f"Failed stages: {', '.join(failed_stages[:3])}")
        recommended.append("Re-run failed stages or accept limited analysis")

    required_sections = ("executive_summary", "company")
    # Support both formats: dict with "sections" key, or list of section dicts
    if isinstance(report_sections, list):
        sections_by_key = {
            s.get("section_key"): s
            for s in report_sections
            if isinstance(s, dict) and s.get("section_key")
        }
    elif isinstance(report_sections, dict):
        sections_by_key = report_sections.get("sections", {}) or {}
    else:
        sections_by_key = {}
    for key in required_sections:
        sec = sections_by_key.get(key) if isinstance(sections_by_key, dict) else None
        has_content = (
            isinstance(sec, dict) and (sec.get("content_md") or sec.get("content"))
        ) or (sec and not isinstance(sec, dict))
        if not has_content:
            issues.append(f"Report section '{key}' is empty")
            recommended.append(f"Populate {key} section")

    stage_passed = completeness_report.get("stage_passed", True)
    if not stage_passed:
        issues.append("Input completeness below threshold")
        recommended.append("Improve input data quality or accept caveats")

    approved = len(issues) == 0
    return MemoReviewResult(
        approved=approved,
        issues=issues[:10],
        recommended_changes=recommended[:5],
    )
