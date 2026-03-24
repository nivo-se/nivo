"""Phase 7 integration tests — report quality, diagnostics, stage handling.

Uses fixtures and mocked dependencies. Full E2E runs require DB + worker.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock


from backend.orchestrator.run_diagnostics import build_run_diagnostics
from backend.services.deep_research.report_quality_gate import (
    evaluate_report_quality,
)


class TestReportQualityGate:
    """Unit tests for report quality gate."""

    def test_complete_no_limitations(self) -> None:
        sections = [
            {"section_key": "executive_summary", "content_md": "Summary"},
            {"section_key": "financials_and_valuation", "content_md": "Financials"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=False,
            report_degraded_reasons=[],
            valuation_skipped=False,
            node_results={"evidence_validation": {"accepted_count": 5}, "assumption_registry": {"valuation_ready": True}},
        )
        assert result.status == "complete"
        assert result.passed
        assert not result.reason_codes

    def test_complete_with_limitations_valuation_skipped(self) -> None:
        sections = [
            {"section_key": "executive_summary", "content_md": "Summary"},
            {"section_key": "financials_and_valuation", "content_md": "Financials"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=False,
            report_degraded_reasons=[],
            valuation_skipped=True,
            node_results={"evidence_validation": {"accepted_count": 3}, "assumption_registry": {"valuation_ready": False}},
        )
        assert result.status == "complete_with_limitations"
        assert result.passed
        assert "valuation_skipped" in result.reason_codes

    def test_blocked_empty_sections(self) -> None:
        result = evaluate_report_quality(
            sections=[],
            report_degraded=False,
            report_degraded_reasons=[],
            valuation_skipped=False,
            node_results={},
        )
        assert result.status == "blocked"
        assert not result.passed
        assert "empty_sections" in result.reason_codes

    def test_blocked_assumption_registry(self) -> None:
        sections = [
            {"section_key": "executive_summary"},
            {"section_key": "financials_and_valuation"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=False,
            report_degraded_reasons=[],
            valuation_skipped=False,
            node_results={"assumption_registry": {"valuation_ready": False, "blocked_reasons": ["missing_terminal_growth"]}},
        )
        assert result.status == "blocked"
        assert "blocked_assumption_registry" in result.reason_codes

    def test_degraded_report(self) -> None:
        sections = [
            {"section_key": "executive_summary"},
            {"section_key": "financials_and_valuation"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=True,
            report_degraded_reasons=["Stage company_profile failed validation"],
            valuation_skipped=False,
            node_results={"evidence_validation": {"accepted_count": 2}},
        )
        assert result.status == "complete_with_limitations"
        assert "degraded" in result.reason_codes

    def test_degraded_plus_valuation_skipped(self) -> None:
        """Degraded report with valuation skipped produces complete_with_limitations and both codes."""
        sections = [
            {"section_key": "executive_summary"},
            {"section_key": "financials_and_valuation"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=True,
            report_degraded_reasons=["Stage market_analysis failed"],
            valuation_skipped=True,
            node_results={
                "evidence_validation": {"accepted_count": 1},
                "assumption_registry": {"valuation_ready": False, "blocked_reasons": ["no growth"]},
            },
        )
        assert result.status == "complete_with_limitations"
        assert "degraded" in result.reason_codes
        assert "valuation_skipped" in result.reason_codes
        assert "Report generated with incomplete data" in str(result.limitation_summary) or any(
            "Valuation" in limitation for limitation in result.limitation_summary
        )

    def test_weak_evidence_insufficient(self) -> None:
        """Zero accepted evidence with no web sources yields insufficient_evidence."""
        sections = [
            {"section_key": "executive_summary"},
            {"section_key": "financials_and_valuation"},
        ]
        result = evaluate_report_quality(
            sections=sections,
            report_degraded=False,
            report_degraded_reasons=[],
            valuation_skipped=False,
            node_results={"evidence_validation": {"accepted_count": 0}, "web_retrieval": {}},
        )
        assert result.status == "complete_with_limitations"
        assert "insufficient_evidence" in result.reason_codes
        assert "No evidence items accepted" in result.limitation_summary


class TestRunDiagnostics:
    """Unit tests for run diagnostics builder."""

    def test_build_diagnostics_with_complete_run(self) -> None:
        t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t1 = datetime(2026, 1, 1, 12, 1, 30, tzinfo=timezone.utc)
        node_rows = [
            SimpleNamespace(
                node_name="identity",
                started_at=t0,
                completed_at=t1,
                status="completed",
                output_json={"canonical_name": "Acme"},
                error_message=None,
            ),
            SimpleNamespace(
                node_name="evidence_validation",
                started_at=t0,
                completed_at=t1,
                status="completed",
                output_json={"accepted_count": 10, "rejected_count": 2},
                error_message=None,
            ),
            SimpleNamespace(
                node_name="assumption_registry",
                started_at=t0,
                completed_at=t1,
                status="completed",
                output_json={"valuation_ready": True},
                error_message=None,
            ),
            SimpleNamespace(
                node_name="valuation",
                started_at=t0,
                completed_at=t1,
                status="completed",
                output_json={"enterprise_value_msek": 100},
                error_message=None,
            ),
        ]
        report_out = {
            "metadata": {
                "report_degraded": False,
                "report_quality_status": "complete",
                "report_quality_reason_codes": [],
                "report_quality_limitation_summary": [],
            }
        }
        session = MagicMock()
        diag = build_run_diagnostics(
            session=session,
            run_id=MagicMock(),
            company_id=MagicMock(),
            node_rows=node_rows,
            report_generation_output=report_out,
        )
        assert diag["evidence_accepted_count"] == 10
        assert diag["evidence_rejected_count"] == 2
        assert diag["assumption_valuation_ready"] is True
        assert diag["valuation_skipped"] is False
        assert diag["report_quality_status"] == "complete"
        assert "identity" in diag["stage_durations"]
        assert diag["stage_durations"]["identity"] == 90.0

    def test_build_diagnostics_valuation_skipped(self) -> None:
        node_rows = [
            SimpleNamespace(
                node_name="valuation",
                started_at=None,
                completed_at=None,
                status="skipped",
                output_json={"skipped": True, "reason": "valuation_not_ready", "blocked_reasons": ["no terminal growth"]},
                error_message=None,
            ),
        ]
        report_out = {"metadata": {"report_quality_status": "complete_with_limitations", "report_quality_reason_codes": ["valuation_skipped"]}}
        session = MagicMock()
        diag = build_run_diagnostics(
            session=session,
            run_id=MagicMock(),
            company_id=MagicMock(),
            node_rows=node_rows,
            report_generation_output=report_out,
        )
        assert diag["valuation_skipped"] is True
        assert diag["report_quality_status"] == "complete_with_limitations"
        assert "valuation_skipped" in diag["report_quality_reason_codes"]

    def test_build_diagnostics_no_report_output(self) -> None:
        node_rows = [
            SimpleNamespace(
                node_name="identity",
                started_at=None,
                completed_at=None,
                status="failed",
                output_json={},
                error_message="Company not found",
            ),
        ]
        diag = build_run_diagnostics(
            session=MagicMock(),
            run_id=MagicMock(),
            company_id=MagicMock(),
            node_rows=node_rows,
            report_generation_output=None,
        )
        assert "identity:Company not found" in diag["failure_reason_codes"] or any(
            "identity" in c for c in diag["failure_reason_codes"]
        )
        assert diag["report_quality_status"] is None


class TestValidationSummary:
    """Release-validation summary builder — compact diagnostics output."""

    def test_build_validation_summary_from_diagnostics(self) -> None:
        from backend.api.deep_research_routes.analysis import _build_validation_summary
        from backend.db.models.deep_research import AnalysisRun

        run = MagicMock(spec=AnalysisRun)
        run.id = "00000000-0000-0000-0000-000000000001"
        run.status = "completed"
        run.error_message = None
        run.extra = {
            "run_diagnostics": {
                "report_quality_status": "complete_with_limitations",
                "report_quality_reason_codes": ["valuation_skipped", "degraded"],
                "report_quality_limitation_summary": ["Valuation was skipped"],
                "assumption_valuation_ready": False,
                "assumption_blocked_reasons": ["missing_terminal_growth"],
                "valuation_skipped": True,
                "report_degraded": True,
                "evidence_accepted_count": 2,
                "evidence_rejected_count": 5,
                "stage_durations": {"identity": 10.5, "valuation": 0},
                "failure_reason_codes": [],
            }
        }

        summary = _build_validation_summary(run)
        assert summary["report_quality_status"] == "complete_with_limitations"
        assert "valuation_skipped" in summary["report_quality_reason_codes"]
        assert "degraded" in summary["report_quality_reason_codes"]
        assert summary["assumption_valuation_ready"] is False
        assert summary["assumption_blocked_reasons"] == ["missing_terminal_growth"]
        assert summary["valuation_skipped"] is True
        assert summary["report_degraded"] is True
        assert summary["evidence_accepted_count"] == 2
        assert summary["evidence_rejected_count"] == 5
        assert summary["stage_durations"]["identity"] == 10.5

    def test_build_validation_summary_empty_diagnostics(self) -> None:
        from backend.api.deep_research_routes.analysis import _build_validation_summary
        from backend.db.models.deep_research import AnalysisRun

        run = MagicMock(spec=AnalysisRun)
        run.id = "00000000-0000-0000-0000-000000000002"
        run.status = "failed"
        run.error_message = "Pipeline error"
        run.extra = None

        summary = _build_validation_summary(run)
        assert summary["status"] == "failed"
        assert summary["error_message"] == "Pipeline error"
        assert summary["report_quality_status"] is None
        assert summary["report_quality_reason_codes"] == []
        assert summary["valuation_skipped"] is False
