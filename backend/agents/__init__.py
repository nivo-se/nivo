"""Agent module scaffolding for Deep Research."""

from .company_profile_agent import CompanyProfileAgent
from .competitor_discovery_agent import CompetitorDiscoveryAgent
from .competitor_profiling_agent import CompetitorProfilingAgent
from .financial_modeling_agent import FinancialModelingAgent
from .identity_agent import IdentityAgent
from .market_analysis_agent import MarketAnalysisAgent
from .registry import AgentRegistry
from .schemas import (
    AgentClaim,
    CompanyProfileAgentOutput,
    CompetitorDiscoveryAgentOutput,
    CompetitorProfilingAgentOutput,
    FinancialModelingAgentOutput,
    IdentityAgentOutput,
    MarketAnalysisAgentOutput,
    StrategyAnalysisAgentOutput,
    ValuationAnalysisAgentOutput,
    ValueCreationIdentificationAgentOutput,
)
from .strategy_analysis_agent import StrategyAnalysisAgent
from .valuation_analysis_agent import ValuationAnalysisAgent
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
    "FinancialModelingAgent",
    "FinancialModelingAgentOutput",
    "IdentityAgent",
    "IdentityAgentOutput",
    "MarketAnalysisAgent",
    "MarketAnalysisAgentOutput",
    "StrategyAnalysisAgent",
    "StrategyAnalysisAgentOutput",
    "ValuationAnalysisAgent",
    "ValuationAnalysisAgentOutput",
    "ValueCreationIdentificationAgent",
    "ValueCreationIdentificationAgentOutput",
]

