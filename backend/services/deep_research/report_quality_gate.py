"""Report quality gate — final check before marking a run complete.

Inspects degraded state, missing sections, evidence/assumption coverage,
and contradictions. Persists report_quality_status and reason codes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# Machine-readable reason codes for quality gate
REPORT_QUALITY_CODES = frozenset({
    "degraded",
    "missing_executive_summary",
    "missing_financials",
    "missing_valuation",
    "valuation_skipped",
    "insufficient_evidence",
    "insufficient_assumptions",
    "metadata_mismatch",
    "empty_sections",
    "blocked_assumption_registry",
})


@dataclass(slots=True)
class ReportQualityResult:
    """Result of the report quality gate."""

    status: str  # "complete" | "complete_with_limitations" | "blocked" | "failed"
    passed: bool
    reason_codes: list[str] = field(default_factory=list)
    limitation_summary: list[str] = field(default_factory=list)


def _check_sections(
    sections: list[dict[str, Any]],
    report_degraded: bool,
    report_degraded_reasons: list[str],
    valuation_skipped: bool,
) -> tuple[list[str], list[str]]:
    """Return (reason_codes, limitation_summary) from section inspection."""
    codes: list[str] = []
    limits: list[str] = []

    section_keys = {s.get("section_key") for s in sections if s.get("section_key")}
    if not section_keys:
        codes.append("empty_sections")
        limits.append("Report has no sections")
        return codes, limits

    if "executive_summary" not in section_keys:
        codes.append("missing_executive_summary")
        limits.append("Executive summary missing")
    if "historical_financials" not in section_keys and "financials_and_valuation" not in section_keys:
        codes.append("missing_financials")
        limits.append("Financial sections missing")

    if valuation_skipped:
        codes.append("valuation_skipped")
        limits.append("Valuation was skipped (insufficient evidence or assumptions)")
    elif "financials_and_valuation" in section_keys:
        # Valuation present — no valuation_skipped code
        pass

    if report_degraded and report_degraded_reasons:
        codes.append("degraded")
        for r in report_degraded_reasons[:3]:  # Cap at 3
            limits.append(r)

    return codes, limits


def _check_evidence_coverage(node_results: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Inspect evidence validation and web retrieval for coverage."""
    codes: list[str] = []
    limits: list[str] = []

    ev_out = node_results.get("evidence_validation", {})
    if isinstance(ev_out, dict):
        accepted = ev_out.get("accepted_count") or ev_out.get("items_count") or 0
        if accepted == 0:
            web_out = node_results.get("web_retrieval", {})
            web_count = (
                len(web_out.get("normalized_sources", []))
                if isinstance(web_out, dict) else 0
            )
            if web_count == 0:
                codes.append("insufficient_evidence")
                limits.append("No evidence items accepted")

    return codes, limits


def _check_assumption_coverage(node_results: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Inspect assumption registry for readiness."""
    codes: list[str] = []
    limits: list[str] = []

    assump = node_results.get("assumption_registry", {})
    if isinstance(assump, dict):
        valuation_ready = assump.get("valuation_ready", True)
        if not valuation_ready:
            codes.append("blocked_assumption_registry")
            blocked = assump.get("blocked_reasons", [])
            for b in blocked[:2]:
                limits.append(str(b))

    return codes, limits


def _has_accepted_evidence(node_results: dict[str, Any]) -> bool:
    """Return True when the run has at least one accepted evidence item."""
    ev_out = node_results.get("evidence_validation", {})
    if not isinstance(ev_out, dict):
        return False
    accepted = ev_out.get("accepted_count")
    if accepted is None:
        accepted = ev_out.get("items_count")
    try:
        return int(accepted or 0) > 0
    except (TypeError, ValueError):
        return False


def evaluate_report_quality(
    *,
    sections: list[dict[str, Any]],
    report_degraded: bool,
    report_degraded_reasons: list[str],
    valuation_skipped: bool,
    node_results: dict[str, Any],
) -> ReportQualityResult:
    """Run the report quality gate.

    Returns status:
    - complete: No limitations, report is fully usable
    - complete_with_limitations: Report usable but has known gaps
    - blocked: Critical blockage (e.g. blocked assumption registry)
    - failed: Run failed before report could be meaningfully generated
    """
    all_codes: list[str] = []
    all_limits: list[str] = []

    sec_codes, sec_limits = _check_sections(
        sections, report_degraded, report_degraded_reasons, valuation_skipped
    )
    all_codes.extend(sec_codes)
    all_limits.extend(sec_limits)

    ev_codes, ev_limits = _check_evidence_coverage(node_results)
    all_codes.extend(ev_codes)
    all_limits.extend(ev_limits)

    assump_codes, assump_limits = _check_assumption_coverage(node_results)
    all_codes.extend(assump_codes)
    all_limits.extend(assump_limits)

    # Dedupe
    all_codes = list(dict.fromkeys(all_codes))
    all_limits = list(dict.fromkeys(all_limits))

    assumption_blocked = "blocked_assumption_registry" in all_codes
    graceful_valuation_skip = valuation_skipped and _has_accepted_evidence(node_results)

    if "empty_sections" in all_codes or (assumption_blocked and not graceful_valuation_skip):
        status = "blocked"
        passed = False
    elif all_codes or all_limits:
        status = "complete_with_limitations"
        passed = True
    else:
        status = "complete"
        passed = True

    return ReportQualityResult(
        status=status,
        passed=passed,
        reason_codes=all_codes,
        limitation_summary=all_limits,
    )
