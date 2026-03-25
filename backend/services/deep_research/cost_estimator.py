"""Cost estimate for Deep Research runs before any OpenAI agent query.

Used to show users an estimated cost prior to starting a run.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.config import get_settings

# Per-1K token pricing (USD) — update when OpenAI pricing changes
COST_PER_1K_INPUT = {
    "gpt-4o-mini": 0.00015,
    "gpt-4o": 0.005,
    "gpt-4o-mini-search-preview": 0.00017,
}
COST_PER_1K_OUTPUT = {
    "gpt-4o-mini": 0.0006,
    "gpt-4o": 0.015,
    "gpt-4o-mini-search-preview": 0.00066,
}


@dataclass
class StageEstimate:
    stage: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


def _cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp = (input_tokens / 1000) * COST_PER_1K_INPUT.get(model, 0.00015)
    out = (output_tokens / 1000) * COST_PER_1K_OUTPUT.get(model, 0.0006)
    return round(inp + out, 6)


def estimate_run_cost(analysis_type: str = "full") -> dict:
    """Estimate USD cost for a Deep Research run.

    Returns breakdown by stage and total. Uses typical token counts per stage.
    """
    settings = get_settings()
    use_openai_market = getattr(settings, "use_openai_agent_for_market_analysis", False)
    use_openai_search = (
        getattr(settings, "web_retrieval_search_provider", "tavily") or "tavily"
    ).lower() == "openai"

    stages: list[StageEstimate] = []

    # company_understanding — always runs, LLM
    stages.append(
        StageEstimate(
            stage="company_understanding",
            model="gpt-4o-mini",
            input_tokens=3000,
            output_tokens=800,
            cost_usd=_cost("gpt-4o-mini", 3000, 800),
        )
    )

    # company_profile — LLM
    stages.append(
        StageEstimate(
            stage="company_profile",
            model="gpt-4o-mini",
            input_tokens=8000,
            output_tokens=1200,
            cost_usd=_cost("gpt-4o-mini", 8000, 1200),
        )
    )

    # market_analysis — OpenAI Agents SDK when enabled
    if use_openai_market:
        stages.append(
            StageEstimate(
                stage="market_analysis",
                model="gpt-4o-mini",
                input_tokens=12000,
                output_tokens=600,
                cost_usd=_cost("gpt-4o-mini", 12000, 600),
            )
        )

    # web_retrieval — OpenAI web search when enabled (per-query model call)
    if use_openai_search:
        # ~4 queries × 1 model call each
        stages.append(
            StageEstimate(
                stage="web_retrieval",
                model="gpt-4o-mini-search-preview",
                input_tokens=2000,
                output_tokens=1500,
                cost_usd=_cost("gpt-4o-mini-search-preview", 2000, 1500) * 4,
            )
        )

    # Other agents that may use LLM: competitor_discovery, product, transaction, strategy, value_creation
    for stage_name, (in_tok, out_tok) in [
        ("competitor_discovery", (6000, 800)),
        ("product_research", (5000, 600)),
        ("transaction_research", (4000, 500)),
        ("strategy", (8000, 1000)),
        ("value_creation", (6000, 800)),
    ]:
        stages.append(
            StageEstimate(
                stage=stage_name,
                model="gpt-4o-mini",
                input_tokens=in_tok,
                output_tokens=out_tok,
                cost_usd=_cost("gpt-4o-mini", in_tok, out_tok),
            )
        )

    # report_narrative — gpt-4o for quality
    if analysis_type == "full":
        stages.append(
            StageEstimate(
                stage="report_narrative",
                model="gpt-4o",
                input_tokens=15000,
                output_tokens=4000,
                cost_usd=_cost("gpt-4o", 15000, 4000),
            )
        )
    else:
        stages.append(
            StageEstimate(
                stage="report_narrative",
                model="gpt-4o-mini",
                input_tokens=8000,
                output_tokens=2000,
                cost_usd=_cost("gpt-4o-mini", 8000, 2000),
            )
        )

    total = sum(s.cost_usd for s in stages)
    breakdown = [
        {"stage": s.stage, "model": s.model, "cost_usd": s.cost_usd}
        for s in stages
    ]

    return {
        "total_usd": round(total, 4),
        "breakdown": breakdown,
        "analysis_type": analysis_type,
        "openai_market_agent_enabled": use_openai_market,
        "openai_web_search_enabled": use_openai_search,
    }
