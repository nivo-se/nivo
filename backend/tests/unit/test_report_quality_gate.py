"""Unit tests for report quality gate."""

from __future__ import annotations

import pytest

from backend.services.deep_research.report_quality_gate import (
    evaluate_report_quality,
    ReportQualityResult,
)


def test_quality_complete_when_all_present() -> None:
    """Full report with no limitations passes as complete."""
    result = evaluate_report_quality(
        sections=[
            {"section_key": "executive_summary", "heading": "Summary", "content_md": "X"},
            {"section_key": "financials_and_valuation", "heading": "Financials", "content_md": "Y"},
        ],
        report_degraded=False,
        report_degraded_reasons=[],
        valuation_skipped=False,
        node_results={
            "evidence_validation": {"accepted_count": 5},
            "assumption_registry": {"valuation_ready": True},
        },
    )
    assert result.status == "complete"
    assert result.passed is True
    assert "valuation_skipped" not in result.reason_codes
    assert len(result.limitation_summary) == 0


def test_quality_complete_with_limitations_when_valuation_skipped() -> None:
    """Valuation skipped yields complete_with_limitations."""
    result = evaluate_report_quality(
        sections=[
            {"section_key": "executive_summary", "heading": "Summary", "content_md": "X"},
            {"section_key": "financials_and_valuation", "heading": "Financials", "content_md": "Y"},
        ],
        report_degraded=False,
        report_degraded_reasons=[],
        valuation_skipped=True,
        node_results={
            "evidence_validation": {"accepted_count": 3},
            "assumption_registry": {"valuation_ready": False, "blocked_reasons": ["missing terminal growth"]},
        },
    )
    assert result.status == "complete_with_limitations"
    assert result.passed is True
    assert "valuation_skipped" in result.reason_codes
    assert "blocked_assumption_registry" in result.reason_codes
    assert any("terminal growth" in s for s in result.limitation_summary)


def test_quality_blocked_when_empty_sections() -> None:
    """Empty sections yields blocked."""
    result = evaluate_report_quality(
        sections=[],
        report_degraded=False,
        report_degraded_reasons=[],
        valuation_skipped=False,
        node_results={},
    )
    assert result.status == "blocked"
    assert result.passed is False
    assert "empty_sections" in result.reason_codes


def test_quality_blocked_when_blocked_assumption_registry() -> None:
    """Blocked assumption registry with no valuation yields blocked."""
    result = evaluate_report_quality(
        sections=[
            {"section_key": "executive_summary", "heading": "Summary", "content_md": "X"},
            {"section_key": "financials_and_valuation", "heading": "Financials", "content_md": "Y"},
        ],
        report_degraded=False,
        report_degraded_reasons=[],
        valuation_skipped=True,
        node_results={
            "assumption_registry": {"valuation_ready": False, "blocked_reasons": ["missing key assumptions"]},
        },
    )
    # blocked_assumption_registry is in codes; status can be complete_with_limitations or blocked
    # per current logic: blocked only when blocked_assumption_registry OR empty_sections
    assert "blocked_assumption_registry" in result.reason_codes
    assert result.status == "blocked"


def test_quality_insufficient_evidence() -> None:
    """No evidence yields insufficient_evidence and complete_with_limitations."""
    result = evaluate_report_quality(
        sections=[
            {"section_key": "executive_summary", "heading": "Summary", "content_md": "X"},
            {"section_key": "financials_and_valuation", "heading": "Financials", "content_md": "Y"},
        ],
        report_degraded=False,
        report_degraded_reasons=[],
        valuation_skipped=False,
        node_results={
            "evidence_validation": {"accepted_count": 0},
            "web_retrieval": {"normalized_sources": []},
        },
    )
    assert "insufficient_evidence" in result.reason_codes
    assert result.status == "complete_with_limitations"
