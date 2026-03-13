"""Policy file loading for Deep Research V2.

Loads versioned policy configs per docs/deep_research/tightning/03-policy-framework.md.
Policies are code-driven; report_spec references policy versions by ID.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Policies live at repo root config/policies/
_REPO_ROOT = Path(__file__).resolve().parents[2]
_POLICIES_DIR = _REPO_ROOT / "config" / "policies"

POLICY_FILENAMES = {
    "valuation_policy": "valuation_policy.dcf_v1.yaml",
    "comp_policy": "comp_policy.multiples_v1.yaml",
    "evidence_policy": "evidence_policy.evidence_v1.yaml",
    "uncertainty_policy": "uncertainty_policy.uncertainty_v1.yaml",
}


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load YAML file; returns empty dict on failure."""
    try:
        import yaml
    except ImportError:
        logger.warning("PyYAML not installed; policy loading disabled")
        return {}
    if not path.exists():
        logger.warning("Policy file not found: %s", path)
        return {}
    try:
        with path.open() as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        logger.warning("Failed to load policy %s: %s", path, e)
        return {}


def load_policy(policy_family: str, version: str | None = None) -> dict[str, Any]:
    """Load a policy by family and optional version.

    Args:
        policy_family: One of valuation_policy, comp_policy, evidence_policy, uncertainty_policy
        version: Optional version override (e.g. dcf_v1). If None, uses default from filename.

    Returns:
        Policy dict (empty if not found).
    """
    filename = POLICY_FILENAMES.get(policy_family)
    if not filename:
        logger.warning("Unknown policy family: %s", policy_family)
        return {}
    path = _POLICIES_DIR / filename
    data = _load_yaml(path)
    if data and version and data.get("version") != version:
        logger.info(
            "Policy %s requested version %s but file has %s",
            policy_family,
            version,
            data.get("version"),
        )
    return data


def load_policy_versions(
    valuation_version: str = "dcf_v1",
    comp_version: str = "multiples_v1",
    evidence_version: str = "evidence_v1",
    uncertainty_version: str = "uncertainty_v1",
) -> dict[str, dict[str, Any]]:
    """Load all policies for a run context.

    Returns:
        Dict keyed by family (valuation_policy, comp_policy, etc.) with policy dicts.
    """
    return {
        "valuation_policy": load_policy("valuation_policy", valuation_version),
        "comp_policy": load_policy("comp_policy", comp_version),
        "evidence_policy": load_policy("evidence_policy", evidence_version),
        "uncertainty_policy": load_policy("uncertainty_policy", uncertainty_version),
    }


def get_default_policy_versions() -> dict[str, str]:
    """Default policy versions for new report specs."""
    return {
        "valuation_policy_version": "dcf_v1",
        "comp_policy_version": "multiples_v1",
        "evidence_policy_version": "evidence_v1",
        "uncertainty_policy_version": "uncertainty_v1",
    }
