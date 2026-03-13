"""Build run diagnostics for observability — stage durations, evidence counts, etc."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session


def _duration_sec(start: datetime | None, end: datetime | None) -> float | None:
    if start is None or end is None:
        return None
    delta = end - start
    return delta.total_seconds()


def build_run_diagnostics(
    *,
    session: Session,
    run_id: uuid.UUID,
    company_id: uuid.UUID,
    node_rows: list,
    report_generation_output: dict | None,
) -> dict[str, Any]:
    """Build diagnostics dict for a completed run.

    Includes:
    - stage_durations: {node_name: seconds}
    - failure_reason_codes: list from failed nodes
    - evidence_accepted_count, evidence_rejected_count
    - assumption_valuation_ready, assumption_blocked_reasons
    - valuation_skipped, valuation_readiness
    - report_degraded, report_quality_status, report_quality_reason_codes
    """
    diagnostics: dict[str, Any] = {
        "stage_durations": {},
        "failure_reason_codes": [],
        "evidence_accepted_count": None,
        "evidence_rejected_count": None,
        "assumption_valuation_ready": None,
        "assumption_blocked_reasons": [],
        "valuation_skipped": False,
        "valuation_readiness": True,
        "report_degraded": False,
        "report_quality_status": None,
        "report_quality_reason_codes": [],
        "report_quality_limitation_summary": [],
    }

    for row in node_rows:
        name = getattr(row, "node_name", None)
        if not name:
            continue
        dur = _duration_sec(
            getattr(row, "started_at", None),
            getattr(row, "completed_at", None),
        )
        if dur is not None:
            diagnostics["stage_durations"][name] = round(dur, 1)

        if getattr(row, "status", None) == "failed":
            out = getattr(row, "output_json", None) or {}
            err = getattr(row, "error_message", None)
            if err:
                diagnostics["failure_reason_codes"].append(f"{name}:{err[:64]}")
            if isinstance(out, dict) and out.get("skipped") and out.get("reason"):
                diagnostics["failure_reason_codes"].append(
                    f"{name}:{out.get('reason', 'skipped')}"
                )

    # Evidence from evidence_validation or web_retrieval
    ev_row = next((r for r in node_rows if getattr(r, "node_name", None) == "evidence_validation"), None)
    if ev_row and isinstance(getattr(ev_row, "output_json", None), dict):
        out = ev_row.output_json
        diagnostics["evidence_accepted_count"] = out.get("accepted_count") or out.get("items_count")
        diagnostics["evidence_rejected_count"] = out.get("rejected_count")
    web_row = next((r for r in node_rows if getattr(r, "node_name", None) == "web_retrieval"), None)
    if web_row and diagnostics["evidence_accepted_count"] is None and isinstance(getattr(web_row, "output_json", None), dict):
        out = web_row.output_json
        sources = out.get("normalized_sources", []) or out.get("queries_executed", [])
        diagnostics["evidence_accepted_count"] = len(sources) if isinstance(sources, list) else 0

    # Assumption registry
    ar_row = next((r for r in node_rows if getattr(r, "node_name", None) == "assumption_registry"), None)
    if ar_row and isinstance(getattr(ar_row, "output_json", None), dict):
        out = ar_row.output_json
        diagnostics["assumption_valuation_ready"] = out.get("valuation_ready", True)
        diagnostics["assumption_blocked_reasons"] = out.get("blocked_reasons", []) or []

    # Valuation
    val_row = next((r for r in node_rows if getattr(r, "node_name", None) == "valuation"), None)
    if val_row and isinstance(getattr(val_row, "output_json", None), dict):
        out = val_row.output_json
        diagnostics["valuation_skipped"] = out.get("skipped") is True
        diagnostics["valuation_readiness"] = not out.get("skipped", False)

    # Report quality from report_generation output
    if isinstance(report_generation_output, dict):
        meta = report_generation_output.get("metadata", {}) or {}
        diagnostics["report_degraded"] = meta.get("report_degraded", False)
        diagnostics["report_quality_status"] = meta.get("report_quality_status")
        diagnostics["report_quality_reason_codes"] = meta.get("report_quality_reason_codes", []) or []
        diagnostics["report_quality_limitation_summary"] = meta.get("report_quality_limitation_summary", []) or []

    return diagnostics
