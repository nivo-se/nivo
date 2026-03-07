"""State contract for LangGraph Deep Research orchestrator."""

from __future__ import annotations

from typing import Any, TypedDict


class OrchestratorState(TypedDict, total=False):
    run_id: str
    company_id: str
    orgnr: str
    company_name: str
    website: str | None
    query: str
    status: str
    current_node: str
    node_results: dict[str, Any]
    errors: list[str]
    started_at: str
    completed_at: str

