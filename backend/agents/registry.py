"""Agent registry for Deep Research runtime wiring."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .company_profile_agent import CompanyProfileAgent
from .competitor_discovery_agent import CompetitorDiscoveryAgent
from .competitor_profiling_agent import CompetitorProfilingAgent
from .financial_modeling_agent import FinancialModelingAgent
from .identity_agent import IdentityAgent
from .market_analysis_agent import MarketAnalysisAgent
from .strategy_analysis_agent import StrategyAnalysisAgent
from .valuation_analysis_agent import ValuationAnalysisAgent
from .value_creation_identification_agent import ValueCreationIdentificationAgent


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
        registry.register("competitor_discovery", CompetitorDiscoveryAgent())
        registry.register("competitor_profiling", CompetitorProfilingAgent())
        registry.register("strategy_analysis", StrategyAnalysisAgent())
        registry.register("financial_modeling", FinancialModelingAgent())
        registry.register("valuation_analysis", ValuationAnalysisAgent())
        registry.register(
            "value_creation_identification", ValueCreationIdentificationAgent()
        )
        return registry

    def register(self, name: str, agent: object) -> None:
        self.agents[name] = agent

    def list_agents(self) -> List[str]:
        return sorted(self.agents.keys())

    def get(self, name: str):
        return self.agents.get(name)

