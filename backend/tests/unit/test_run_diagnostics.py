"""Unit tests for run diagnostics builder."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock


from backend.orchestrator.run_diagnostics import build_run_diagnostics


def _mock_node(node_name: str, status: str, started_at: datetime | None, completed_at: datetime | None, output_json: dict | None = None, error_message: str | None = None) -> MagicMock:
    node = MagicMock()
    node.node_name = node_name
    node.status = status
    node.started_at = started_at
    node.completed_at = completed_at
    node.output_json = output_json or {}
    node.error_message = error_message
    return node


def test_build_diagnostics_stage_durations() -> None:
    """Stage durations computed from started_at and completed_at."""
    t0 = datetime(2026, 1, 1, 12, 0, 0)
    t1 = datetime(2026, 1, 1, 12, 1, 30)  # 90 seconds later
    node_rows = [
        _mock_node("identity", "completed", t0, t1),
        _mock_node("company_understanding", "completed", t1, None),
    ]
    report_output = {"metadata": {"report_quality_status": "complete"}}
    diag = build_run_diagnostics(
        session=MagicMock(),
        run_id=__import__("uuid").uuid4(),
        company_id=__import__("uuid").uuid4(),
        node_rows=node_rows,
        report_generation_output=report_output,
    )
    assert diag["stage_durations"]["identity"] == 90.0
    assert "company_understanding" not in diag["stage_durations"]
    assert diag["report_quality_status"] == "complete"


def test_build_diagnostics_valuation_skipped() -> None:
    """Valuation skipped and assumption blocked captured."""
    node_rows = [
        _mock_node("assumption_registry", "completed", None, None, {"valuation_ready": False, "blocked_reasons": ["missing growth"]}),
        _mock_node("valuation", "skipped", None, None, {"skipped": True, "reason": "valuation_not_ready", "blocked_reasons": ["missing growth"]}),
    ]
    report_output = {"metadata": {"report_quality_status": "complete_with_limitations", "report_quality_limitation_summary": ["Valuation skipped"]}}
    diag = build_run_diagnostics(
        session=MagicMock(),
        run_id=__import__("uuid").uuid4(),
        company_id=__import__("uuid").uuid4(),
        node_rows=node_rows,
        report_generation_output=report_output,
    )
    assert diag["valuation_skipped"] is True
    assert diag["assumption_valuation_ready"] is False
    assert diag["assumption_blocked_reasons"] == ["missing growth"]
    assert diag["report_quality_status"] == "complete_with_limitations"
    assert "Valuation skipped" in diag["report_quality_limitation_summary"]


def test_build_diagnostics_evidence_counts() -> None:
    """Evidence accepted/rejected from evidence_validation output."""
    node_rows = [
        _mock_node("evidence_validation", "completed", None, None, {"accepted_count": 12, "rejected_count": 3}),
    ]
    diag = build_run_diagnostics(
        session=MagicMock(),
        run_id=__import__("uuid").uuid4(),
        company_id=__import__("uuid").uuid4(),
        node_rows=node_rows,
        report_generation_output=None,
    )
    assert diag["evidence_accepted_count"] == 12
    assert diag["evidence_rejected_count"] == 3


def test_build_diagnostics_failure_codes() -> None:
    """Failed node produces failure_reason_codes."""
    node_rows = [
        _mock_node("web_retrieval", "failed", None, None, {}, "Tavily API key missing"),
    ]
    diag = build_run_diagnostics(
        session=MagicMock(),
        run_id=__import__("uuid").uuid4(),
        company_id=__import__("uuid").uuid4(),
        node_rows=node_rows,
        report_generation_output=None,
    )
    assert len(diag["failure_reason_codes"]) >= 1
    assert any("web_retrieval" in c for c in diag["failure_reason_codes"])
