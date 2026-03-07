"""Agent registry scaffold (no research logic yet)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .company_profile_agent import CompanyProfileAgent
from .identity_agent import IdentityAgent
from .market_analysis_agent import MarketAnalysisAgent


@dataclass(slots=True)
class AgentRegistry:
    """Holds available agent identifiers for runtime wiring."""

    agents: Dict[str, object] = field(default_factory=dict)

    @classmethod
    def default(cls) -> "AgentRegistry":
        registry = cls()
        registry.register("identity", IdentityAgent())
        registry.register("company_profile", CompanyProfileAgent())
        registry.register("market_analysis", MarketAnalysisAgent())
        return registry

    def register(self, name: str, agent: object) -> None:
        self.agents[name] = agent

    def list_agents(self) -> List[str]:
        return sorted(self.agents.keys())

    def get(self, name: str):
        return self.agents.get(name)

