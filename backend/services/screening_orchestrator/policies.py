"""Campaign policy helpers (uncertain relevance, Layer 2/3 eligibility)."""

from __future__ import annotations

import json
from typing import Any, Dict


def _params_dict(params: Any) -> Dict[str, Any]:
    if params is None:
        return {}
    if isinstance(params, dict):
        return dict(params)
    if isinstance(params, str):
        try:
            return dict(json.loads(params))
        except json.JSONDecodeError:
            return {}
    return {}


def uncertain_relevance_mode(params: Any) -> str:
    """
    How to treat Layer 1 `uncertain` downstream.

    - ``pass_to_layer2`` — include in Layer 2 / shortlist consideration (default).
    - ``reject`` — treat like fail for Layer 2 eligibility, scoring, and shortlist.
    """
    p = _params_dict(params).get("policy") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except json.JSONDecodeError:
            p = {}
    if not isinstance(p, dict):
        p = {}
    v = p.get("uncertainRelevance") or p.get("uncertain_relevance") or "pass_to_layer2"
    v = str(v).strip()
    if v in ("reject", "pass_to_layer2"):
        return v
    return "pass_to_layer2"


def layer1_web_retrieval_enabled(params: Any) -> bool:
    """When True, run Tavily snippets before the Layer 1 LLM (extra cost)."""
    p = _params_dict(params).get("policy") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except json.JSONDecodeError:
            p = {}
    if not isinstance(p, dict):
        p = {}
    v = p.get("layer1WebRetrieval")
    if v is None:
        v = p.get("layer1_web_retrieval")
    if v is True:
        return True
    if v is False:
        return False
    if isinstance(v, str) and v.lower() in ("1", "true", "yes"):
        return True
    return False


def relevance_eligible_for_fit(relevance_status: str | None, params: Any) -> bool:
    """Layer 2 runs on in_mandate, and uncertain only when policy allows."""
    r = (relevance_status or "").strip()
    if r == "in_mandate":
        return True
    if r != "uncertain":
        return False
    return uncertain_relevance_mode(params) == "pass_to_layer2"


def relevance_eligible_for_shortlist(relevance_status: str | None, params: Any) -> bool:
    """Final shortlist: same as fit, plus we never select out_of_mandate."""
    r = (relevance_status or "").strip()
    if r == "out_of_mandate":
        return False
    if r == "in_mandate":
        return True
    if r == "uncertain":
        return uncertain_relevance_mode(params) == "pass_to_layer2"
    return False
