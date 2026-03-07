"""LangGraph runtime scaffolding (graph wiring only)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(slots=True)
class LangGraphRuntime:
    """Creates a minimal placeholder graph to validate dependency wiring."""

    enabled: bool = True

    def check(self) -> tuple[bool, Optional[str]]:
        if not self.enabled:
            return False, "LangGraph disabled by configuration"
        try:
            from langgraph.graph import StateGraph  # local import for optional runtime

            _ = StateGraph(dict)
            return True, None
        except Exception as exc:  # pragma: no cover - defensive runtime check
            return False, str(exc)

