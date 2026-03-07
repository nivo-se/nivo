"""Agent module scaffolding for Deep Research."""

from .company_profile_agent import CompanyProfileAgent
from .competitor_discovery_agent import CompetitorDiscoveryAgent
from .competitor_profiling_agent import CompetitorProfilingAgent
from .identity_agent import IdentityAgent
from .market_analysis_agent import MarketAnalysisAgent
from .registry import AgentRegistry
from .schemas import (
    AgentClaim,
    CompanyProfileAgentOutput,
    CompetitorDiscoveryAgentOutput,
    CompetitorProfilingAgentOutput,
    IdentityAgentOutput,
    MarketAnalysisAgentOutput,
    StrategyAnalysisAgentOutput,
    ValueCreationIdentificationAgentOutput,
)
from .strategy_analysis_agent import StrategyAnalysisAgent
from .value_creation_identification_agent import ValueCreationIdentificationAgent

__all__ = [
    "AgentClaim",
    "AgentRegistry",
    "CompanyProfileAgent",
    "CompanyProfileAgentOutput",
    "CompetitorDiscoveryAgent",
    "CompetitorDiscoveryAgentOutput",
    "CompetitorProfilingAgent",
    "CompetitorProfilingAgentOutput",
    "IdentityAgent",
    "IdentityAgentOutput",
    "MarketAnalysisAgent",
    "MarketAnalysisAgentOutput",
    "StrategyAnalysisAgent",
    "StrategyAnalysisAgentOutput",
    "ValueCreationIdentificationAgent",
    "ValueCreationIdentificationAgentOutput",
]

