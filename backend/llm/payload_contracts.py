"""Payload contracts and cost-control policy for LLM stages in Deep Research."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

MODEL_SELECTION = {
    "company_understanding": "gpt-4o-mini",
    "report_narrative": "gpt-4o",
    "classification": "gpt-4o-mini",
    "synthesis": "gpt-4o",
}

MAX_TOKENS_PER_STAGE = {
    "company_understanding": 2000,
    "report_narrative": 4000,
    "classification": 500,
    "synthesis": 3000,
}

RETRY_BUDGET = {
    "company_understanding": 2,
    "report_narrative": 1,
    "classification": 2,
    "synthesis": 1,
}

REQUIRED_INPUTS: dict[str, list[str]] = {
    "company_understanding": ["company_name", "raw_text"],
    "report_narrative": ["company_name", "sections_data", "analysis_input"],
    "classification": ["text", "categories"],
    "synthesis": ["company_name", "evidence_chunks", "section_key"],
}

BLOCKED_LLM_ROLES = frozenset({
    "financial_math",
    "orchestration",
    "raw_crawling",
    "db_truth",
    "valuation_calculation",
})


@dataclass
class PayloadValidationResult:
    valid: bool
    missing_fields: list[str] = field(default_factory=list)
    stage: str = ""
    model: str = ""
    max_tokens: int = 0


def validate_llm_payload(stage: str, payload: dict[str, Any]) -> PayloadValidationResult:
    """Validate that a payload has all required fields for a given LLM stage.

    Returns a PayloadValidationResult. If not valid, the caller should NOT invoke the LLM.
    """
    required = REQUIRED_INPUTS.get(stage)
    if required is None:
        logger.warning("Unknown LLM stage: %s — blocking call", stage)
        return PayloadValidationResult(
            valid=False,
            missing_fields=[f"unknown_stage:{stage}"],
            stage=stage,
        )

    missing = [f for f in required if not payload.get(f)]
    model = MODEL_SELECTION.get(stage, "gpt-4o-mini")
    max_tokens = MAX_TOKENS_PER_STAGE.get(stage, 1000)

    if missing:
        logger.warning(
            "LLM payload validation failed for stage=%s: missing %s", stage, missing,
        )
        return PayloadValidationResult(
            valid=False,
            missing_fields=missing,
            stage=stage,
            model=model,
            max_tokens=max_tokens,
        )

    return PayloadValidationResult(
        valid=True,
        stage=stage,
        model=model,
        max_tokens=max_tokens,
    )


def is_allowed_llm_role(role: str) -> bool:
    """Check if a given role is allowed to use LLM. Financial math, orchestration, etc. are blocked."""
    return role not in BLOCKED_LLM_ROLES


@dataclass
class LLMCallRecord:
    """Record of an LLM call for logging/auditing."""
    run_id: str
    stage: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    cost_estimate_usd: float = 0.0
    success: bool = True
    error: str | None = None


COST_PER_1K_INPUT = {
    "gpt-4o-mini": 0.00015,
    "gpt-4o": 0.005,
}
COST_PER_1K_OUTPUT = {
    "gpt-4o-mini": 0.0006,
    "gpt-4o": 0.015,
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for an LLM call."""
    input_cost = (input_tokens / 1000) * COST_PER_1K_INPUT.get(model, 0.005)
    output_cost = (output_tokens / 1000) * COST_PER_1K_OUTPUT.get(model, 0.015)
    return round(input_cost + output_cost, 6)
