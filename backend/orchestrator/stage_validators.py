"""Per-stage validation functions for the Generate -> Validate -> Refine -> Approve pattern.

Each validator is a simple Python function (not an agent) that checks the output of a
pipeline stage and returns a StageValidation result.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable

from backend.services.deep_research.input_completeness import DEEP_RESEARCH_THRESHOLDS


STRICT_STAGE_GATING = os.getenv("STRICT_STAGE_GATING", "false").lower() == "true"

MAX_STAGE_RETRIES = 2


class StageValidationError(Exception):
    """Raised when strict gating is enabled and a stage fails validation after all retries."""


@dataclass
class StageValidation:
    status: str  # "pass" | "warn" | "fail"
    issues: list[str] = field(default_factory=list)
    score: int = 100


def validate_identity(output: dict) -> StageValidation:
    issues: list[str] = []
    orgnr = output.get("orgnr", "")
    if not orgnr:
        issues.append("orgnr missing from identity output")
    elif orgnr.startswith("tmp-"):
        issues.append("orgnr is synthetic tmp- (not resolved from main DB)")

    name = output.get("canonical_name") or output.get("company_name", "")
    if not name:
        issues.append("canonical_name missing")

    if issues:
        return StageValidation(status="fail", issues=issues, score=0)
    return StageValidation(status="pass", score=100)


def validate_company_profile(output: dict) -> StageValidation:
    issues: list[str] = []
    for key in ("summary", "business_model"):
        val = output.get(key)
        if not val or (isinstance(val, str) and not val.strip()):
            issues.append(f"{key} missing from company profile")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_market_analysis(output: dict) -> StageValidation:
    issues: list[str] = []
    thresholds = DEEP_RESEARCH_THRESHOLDS

    market_label = output.get("market_label") or output.get("market_size")
    if thresholds["require_market_label"] and not market_label:
        issues.append("market label/size missing")

    growth = output.get("growth_rate") or output.get("market_growth")
    if growth is None:
        issues.append("market growth rate not determined")

    if issues:
        return StageValidation(status="warn", issues=issues, score=50)
    return StageValidation(status="pass", score=100)


def validate_competitors(output: dict) -> StageValidation:
    issues: list[str] = []
    thresholds = DEEP_RESEARCH_THRESHOLDS
    min_comp = thresholds["min_competitors"]

    competitors = output.get("competitors", [])
    if len(competitors) < min_comp:
        issues.append(f"only {len(competitors)} competitors found (threshold: {min_comp})")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


def validate_financial_model(output: dict) -> StageValidation:
    issues: list[str] = []

    assumption_set = output.get("assumption_set")
    if not assumption_set:
        issues.append("assumption_set missing from financial model output")

    forecast = output.get("forecast")
    if not forecast:
        issues.append("forecast missing from financial model output")

    if issues:
        return StageValidation(status="warn", issues=issues, score=40)
    return StageValidation(status="pass", score=100)


def validate_report_quality(output: dict) -> StageValidation:
    issues: list[str] = []

    sections = output.get("sections", {})
    if not sections:
        issues.append("report has no sections")
        return StageValidation(status="fail", issues=issues, score=0)

    for key in ("executive_summary", "company"):
        if key not in sections or not sections[key]:
            issues.append(f"report section '{key}' is empty")

    if issues:
        return StageValidation(status="warn", issues=issues, score=60)
    return StageValidation(status="pass", score=100)


STAGE_VALIDATORS: dict[str, Callable[[dict], StageValidation]] = {
    "identity": validate_identity,
    "company_profile": validate_company_profile,
    "market_analysis": validate_market_analysis,
    "competitor_discovery": validate_competitors,
    "financial_model": validate_financial_model,
    "report_generation": validate_report_quality,
}
