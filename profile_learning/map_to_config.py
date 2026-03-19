"""
Map approved comparison JSON to Layer 1 config_json and produce rejection log.

Source: docs/deep_research/profile_learning/MVP_FILE_SCHEMAS_AND_TEMPLATES.md §5
"""

from __future__ import annotations

from typing import Any

from .models import (
    ALLOWED_ARCHETYPE_CRITERIA_FIELDS,
    ALLOWED_EXCLUSION_FIELDS,
    ALLOWED_EXCLUSION_OPS,
    ALLOWED_NORMALIZE,
    ALLOWED_VARIABLE_SOURCES,
    ARCHETYPE_STRING_CRITERIA_FIELDS,
    EXCLUSION_PERCENT_FIELDS,
)


def _rejection(item_type: str, identifier: str, reason: str) -> dict[str, Any]:
    return {"type": item_type, "identifier": identifier, "reason": reason}


def _valid_range(rng: Any) -> bool:
    if not isinstance(rng, (list, tuple)) or len(rng) < 2:
        return False
    try:
        lo, hi = float(rng[0]), float(rng[1])
        return hi > lo
    except (TypeError, ValueError):
        return False


def generate_config(approved: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Map approved comparison to Layer 1 config_json and build rejection log.

    Args:
        approved: Loaded approved_comparison.json (must have approved_variables, approved_weights,
                  approved_archetypes, approved_exclusion_rules).

    Returns:
        (config_json, rejection_log)
        - config_json: valid for screening_profile_versions.config_json (variables, weights, archetypes, exclusion_rules).
        - rejection_log: list of { "type", "identifier", "reason" } for every rejected item.
    """
    config: dict[str, Any] = {
        "variables": [],
        "weights": {},
        "archetypes": [],
        "exclusion_rules": [],
    }
    rejection_log: list[dict[str, Any]] = []

    # --- Variables ---
    valid_var_ids: set[str] = set()
    for i, v in enumerate(approved.get("approved_variables") or []):
        if not isinstance(v, dict):
            rejection_log.append(_rejection("variable", f"index_{i}", "not an object"))
            continue
        var_id = v.get("id")
        source = v.get("source")
        if not var_id:
            rejection_log.append(_rejection("variable", f"index_{i}", "missing id"))
            continue
        if not source:
            rejection_log.append(_rejection("variable", var_id, "missing source"))
            continue
        if source not in ALLOWED_VARIABLE_SOURCES:
            rejection_log.append(_rejection("variable", var_id, f"source '{source}' not in Layer 1 allowed list"))
            continue
        norm = v.get("normalize", "min_max")
        if norm not in ALLOWED_NORMALIZE:
            rejection_log.append(_rejection("variable", var_id, f"normalize '{norm}' not in (min_max, linear)"))
            continue
        rng = v.get("range")
        if not _valid_range(rng):
            rejection_log.append(_rejection("variable", var_id, "range must be [min, max] with max > min"))
            continue
        config["variables"].append({
            "id": var_id,
            "source": source,
            "normalize": norm,
            "range": [float(rng[0]), float(rng[1])],
        })
        valid_var_ids.add(var_id)

    # --- Weights ---
    for k, w in (approved.get("approved_weights") or {}).items():
        if k not in valid_var_ids:
            rejection_log.append(_rejection("weight", k, "no matching variable id in approved_variables"))
            continue
        try:
            val = float(w)
            if val < 0:
                rejection_log.append(_rejection("weight", k, "weight must be non-negative"))
                continue
            config["weights"][k] = val
        except (TypeError, ValueError):
            rejection_log.append(_rejection("weight", k, "weight must be a number"))

    # --- Archetypes ---
    for i, a in enumerate(approved.get("approved_archetypes") or []):
        if not isinstance(a, dict):
            rejection_log.append(_rejection("archetype", f"index_{i}", "not an object"))
            continue
        code = a.get("code")
        if not code:
            rejection_log.append(_rejection("archetype", f"index_{i}", "missing code"))
            continue
        criteria_raw = a.get("criteria") or {}
        if not isinstance(criteria_raw, dict):
            rejection_log.append(_rejection("archetype", str(code), "criteria must be an object"))
            continue
        criteria_clean: dict[str, Any] = {}
        for field, cond in criteria_raw.items():
            if field not in ALLOWED_ARCHETYPE_CRITERIA_FIELDS:
                rejection_log.append(_rejection("archetype", str(code), f"criteria field '{field}' not allowed"))
                continue
            if not isinstance(cond, dict):
                rejection_log.append(_rejection("archetype", str(code), f"criteria.{field} must be object"))
                continue
            if field in ARCHETYPE_STRING_CRITERIA_FIELDS:
                allowed_ops = {"eq", "gte", "lte"}
            else:
                allowed_ops = {"gte", "lte", "between"}
            clean_cond: dict[str, Any] = {}
            for op, val in cond.items():
                if op not in allowed_ops:
                    rejection_log.append(_rejection("archetype", str(code), f"criteria.{field}.{op} not allowed"))
                    continue
                if op == "between":
                    if not isinstance(val, (list, tuple)) or len(val) < 2:
                        rejection_log.append(_rejection("archetype", str(code), f"criteria.{field}.between must be [min, max]"))
                        continue
                    try:
                        clean_cond["between"] = [float(val[0]), float(val[1])]
                    except (TypeError, ValueError):
                        rejection_log.append(_rejection("archetype", str(code), f"criteria.{field}.between values must be numbers"))
                else:
                    try:
                        if field in ARCHETYPE_STRING_CRITERIA_FIELDS:
                            clean_cond[op] = str(val)
                        else:
                            clean_cond[op] = float(val)
                    except (TypeError, ValueError):
                        rejection_log.append(_rejection("archetype", str(code), f"criteria.{field}.{op} must be number or string"))
            if clean_cond:
                criteria_clean[field] = clean_cond
        if criteria_clean:
            config["archetypes"].append({"code": str(code), "criteria": criteria_clean})

    # --- Exclusion rules ---
    for i, r in enumerate(approved.get("approved_exclusion_rules") or []):
        if not isinstance(r, dict):
            rejection_log.append(_rejection("exclusion_rule", f"index_{i}", "not an object"))
            continue
        field = r.get("field")
        op = r.get("op")
        value = r.get("value")
        if not field:
            rejection_log.append(_rejection("exclusion_rule", f"index_{i}", "missing field"))
            continue
        if field not in ALLOWED_EXCLUSION_FIELDS:
            rejection_log.append(_rejection("exclusion_rule", f"index_{i}", f"field '{field}' not in Layer 1 allowed list"))
            continue
        if op not in ALLOWED_EXCLUSION_OPS:
            rejection_log.append(_rejection("exclusion_rule", f"index_{i}", f"op '{op}' not in (=, >=, <=, between)"))
            continue
        if op == "between":
            if not isinstance(value, (list, tuple)) or len(value) < 2:
                rejection_log.append(_rejection("exclusion_rule", f"index_{i}", "value must be [min, max] for between"))
                continue
            try:
                config["exclusion_rules"].append({
                    "field": field,
                    "op": op,
                    "value": [float(value[0]), float(value[1])],
                })
            except (TypeError, ValueError):
                rejection_log.append(_rejection("exclusion_rule", f"index_{i}", "between value must be [number, number]"))
        else:
            try:
                if field in EXCLUSION_PERCENT_FIELDS:
                    val = float(value)
                else:
                    val = int(value) if isinstance(value, int) else float(value)
                config["exclusion_rules"].append({"field": field, "op": op, "value": val})
            except (TypeError, ValueError):
                rejection_log.append(_rejection("exclusion_rule", f"index_{i}", f"value for {field} must be numeric"))

    return config, rejection_log
