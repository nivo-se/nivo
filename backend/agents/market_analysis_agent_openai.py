"""Market analysis agent using OpenAI Agents SDK (pilot per Deep Research Flow Investigation plan).

When USE_OPENAI_AGENT_FOR_MARKET_ANALYSIS=true, this implementation is used instead of
the heuristic market_analysis_agent. Enables comparison of quality, latency, and cost.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, MarketAnalysisAgentOutput, SourceEvidence

logger = logging.getLogger(__name__)


def _fallback_output(context: AgentContext) -> MarketAnalysisAgentOutput:
    """Fallback when Agents SDK fails or returns invalid output."""
    primary_source = context.primary_source()
    primary_chunk = context.primary_chunk()
    evidence = SourceEvidence(
        source_id=primary_source.source_id if primary_source else None,
        source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
        source_url=primary_source.url if primary_source else None,
        source_title=primary_source.title if primary_source else None,
        excerpt=primary_chunk.text[:280] if primary_chunk else None,
    )
    return MarketAnalysisAgentOutput(
        market_size="Not quantified from current sources",
        growth_rate="Not quantified from current sources",
        trends=[],
        risks=[],
        opportunities=[],
        source_ids=[s.source_id for s in context.sources],
        claims=[
            AgentClaim(
                claim_text="Market analysis unavailable (Agents SDK fallback)",
                claim_type="market_analysis",
                confidence=0.3,
                evidence=evidence,
            )
        ],
        metadata={"fallback": True, "source": "market_analysis_agent_openai"},
    )


@dataclass(slots=True)
class MarketAnalysisAgentOpenAI:
    """Market analysis agent powered by OpenAI Agents SDK.

    Produces structured MarketAnalysisAgentOutput from source evidence.
    Uses JSON output format for schema compliance.
    """

    def run(self, context: AgentContext) -> MarketAnalysisAgentOutput:
        try:
            from agents import Agent, Runner
        except ImportError:
            logger.warning("openai-agents not installed; using fallback")
            return _fallback_output(context)

        text = context.joined_text(max_chars=15000)
        company_name = context.company_name or "Company"

        instructions = """You are a market research analyst. Analyze the provided source evidence about a company and its market.

Output a single JSON object with exactly these keys (no other keys):
- market_size: string (e.g. "X billion SEK", "Not quantified from current sources")
- growth_rate: string (e.g. "X% annually", "Market described as growing", "Not quantified")
- trends: list of strings (max 4, e.g. "Digital transformation demand")
- risks: list of strings (max 4, e.g. "Macroeconomic demand slowdown")
- opportunities: list of strings (max 4, e.g. "Cross-sell expansion")

Extract only from the evidence. If evidence is insufficient, use "Not quantified" or empty lists.
Output ONLY valid JSON, no markdown or extra text."""

        prompt = f"""Company: {company_name}

Source evidence:
---
{text}
---

Analyze and output the JSON object as specified."""

        try:
            agent = Agent(
                name="Market Analyst",
                instructions=instructions,
            )
            result = Runner.run_sync(agent, prompt)
            raw = (result.final_output or "").strip()
        except Exception as e:
            logger.warning("Agents SDK run failed: %s", e)
            return _fallback_output(context)

        # Strip markdown code block if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = "\n".join(lines)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning("Agents SDK output not valid JSON: %s", e)
            return _fallback_output(context)

        market_size = data.get("market_size") or "Not quantified from current sources"
        growth_rate = data.get("growth_rate") or "Not quantified from current sources"
        trends = data.get("trends")
        risks = data.get("risks")
        opportunities = data.get("opportunities")

        if not isinstance(trends, list):
            trends = []
        if not isinstance(risks, list):
            risks = []
        if not isinstance(opportunities, list):
            opportunities = []

        trends = [str(t) for t in trends[:4] if t]
        risks = [str(r) for r in risks[:4] if r]
        opportunities = [str(o) for o in opportunities[:4] if o]

        primary_source = context.primary_source()
        primary_chunk = context.primary_chunk()
        evidence = SourceEvidence(
            source_id=primary_source.source_id if primary_source else None,
            source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
            source_url=primary_source.url if primary_source else None,
            source_title=primary_source.title if primary_source else None,
            excerpt=primary_chunk.text[:280] if primary_chunk else None,
        )

        claims: list[AgentClaim] = []
        for t in trends[:1]:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market trend: {t}",
                    claim_type="market_trend",
                    confidence=0.65,
                    evidence=evidence,
                )
            )
        for r in risks[:1]:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market risk: {r}",
                    claim_type="market_risk",
                    confidence=0.6,
                    evidence=evidence,
                )
            )
        for o in opportunities[:1]:
            claims.append(
                AgentClaim(
                    claim_text=f"Observed market opportunity: {o}",
                    claim_type="market_opportunity",
                    confidence=0.6,
                    evidence=evidence,
                )
            )

        usage = getattr(result, "context_wrapper", None) and getattr(
            result.context_wrapper, "usage", None
        )
        metadata: dict = {
            "source_count": len(context.sources),
            "chunk_count": len(context.chunks),
            "source": "market_analysis_agent_openai",
        }
        if usage:
            metadata["agent_usage"] = {
                "requests": getattr(usage, "requests", None),
                "input_tokens": getattr(usage, "input_tokens", None),
                "output_tokens": getattr(usage, "output_tokens", None),
                "total_tokens": getattr(usage, "total_tokens", None),
            }

        return MarketAnalysisAgentOutput(
            market_size=market_size,
            growth_rate=growth_rate,
            trends=trends,
            risks=risks,
            opportunities=opportunities,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata=metadata,
        )
