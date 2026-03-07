"""Agent registry scaffold (no research logic yet)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(slots=True)
class AgentRegistry:
    """Holds available agent identifiers for runtime wiring."""

    agents: Dict[str, str] = field(default_factory=dict)

    def register(self, name: str, description: str) -> None:
        self.agents[name] = description

    def list_agents(self) -> List[str]:
        return sorted(self.agents.keys())

