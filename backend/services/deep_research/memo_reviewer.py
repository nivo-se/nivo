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
    sections = report_sections.get("sections", {})
    for key in required_sections:
        if key not in sections or not sections.get(key):
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
