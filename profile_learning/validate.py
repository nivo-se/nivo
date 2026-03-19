"""
Validation for profile-learning batch folders and approved comparison files.

Source: docs/deep_research/profile_learning/MVP_FILE_SCHEMAS_AND_TEMPLATES.md
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import (
    ALLOWED_ARCHETYPE_CRITERIA_FIELDS,
    ALLOWED_EXCLUSION_FIELDS,
    ALLOWED_EXCLUSION_OPS,
    ALLOWED_NORMALIZE,
    ALLOWED_VARIABLE_SOURCES,
    ARCHETYPE_STRING_CRITERIA_FIELDS,
    EXCLUSION_PERCENT_FIELDS,
    VALID_USER_LABELS,
)


def _err(msg: str) -> list[str]:
    return [msg]


def validate_batch(batch_root: Path) -> list[str]:
    """
    Validate a profile-learning batch folder.

    Checks: manifest.json exists, report files exist, extraction files are valid JSON
    and have required fields, user labels valid, layout correct.

    Returns list of error messages (empty if valid).
    """
    errors: list[str] = []

    if not batch_root.is_dir():
        errors.append(f"Batch root is not a directory: {batch_root}")
        return errors

    manifest_path = batch_root / "manifest.json"
    if not manifest_path.exists():
        errors.append("manifest.json not found")
        return errors

    try:
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"manifest.json invalid JSON: {e}")
        return errors

    # Required top-level manifest fields
    for key in ("batch_id", "batch_name", "created_at", "reports"):
        if key not in manifest:
            errors.append(f"manifest.json missing required field: {key}")
    if "reports" in manifest and not isinstance(manifest["reports"], list):
        errors.append("manifest.json 'reports' must be an array")

    reports = manifest.get("reports") or []
    report_ids = set()
    for i, report in enumerate(reports):
        if not isinstance(report, dict):
            errors.append(f"manifest reports[{i}] must be an object")
            continue
        rid = report.get("report_id")
        if not rid:
            errors.append(f"manifest reports[{i}] missing report_id")
        elif rid in report_ids:
            errors.append(f"manifest duplicate report_id: {rid}")
        else:
            report_ids.add(rid)

        for key in ("file_path", "legal_name", "user_label"):
            if key not in report:
                errors.append(f"manifest reports[{i}] (report_id={rid or '?'}) missing required field: {key}")
        label = report.get("user_label")
        if label is not None and label not in VALID_USER_LABELS:
            errors.append(f"manifest reports[{i}] invalid user_label: {label} (must be one of strong, maybe, weak, reject)")

        file_path = report.get("file_path")
        if file_path:
            report_file = batch_root / file_path
            if not report_file.exists():
                errors.append(f"Report file not found: {file_path} (resolved: {report_file})")

    # Extractions folder and files
    extractions_dir = batch_root / "extractions"
    if extractions_dir.exists():
        for ext_path in sorted(extractions_dir.iterdir()):
            if ext_path.suffix.lower() != ".json":
                continue
            try:
                with open(ext_path, encoding="utf-8") as f:
                    ext = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"extractions/{ext_path.name} invalid JSON: {e}")
                continue
            if not isinstance(ext, dict):
                errors.append(f"extractions/{ext_path.name} root must be an object")
                continue
            if "report_metadata" not in ext:
                errors.append(f"extractions/{ext_path.name} missing report_metadata")
            else:
                meta = ext.get("report_metadata")
                if isinstance(meta, dict):
                    if meta.get("user_label") is not None and meta.get("user_label") not in VALID_USER_LABELS:
                        errors.append(f"extractions/{ext_path.name} invalid report_metadata.user_label")
                if "report_id" in meta and isinstance(meta.get("report_id"), str) and report_ids and meta["report_id"] not in report_ids:
                    errors.append(f"extractions/{ext_path.name} report_id '{meta.get('report_id')}' not in manifest")
            if "screenability_classification" not in ext:
                errors.append(f"extractions/{ext_path.name} missing screenability_classification")

    return errors


def validate_approved_comparison(data: dict[str, Any]) -> list[str]:
    """
    Validate an approved comparison object (loaded from approved_comparison.json).

    Checks: required keys, approved_variables (source in allowed list, normalize, range),
    approved_weights keys match variable ids, approved_archetypes (criteria fields allowed),
    approved_exclusion_rules (field, op, value), review prompts shape.

    Returns list of error messages (empty if valid).
    """
    errors: list[str] = []

    for key in ("batch_id", "approved_by", "approved_at", "approved_variables", "approved_weights", "approved_archetypes", "approved_exclusion_rules"):
        if key not in data:
            errors.append(f"approved comparison missing required field: {key}")

    variables = data.get("approved_variables")
    if isinstance(variables, list):
        var_ids = set()
        for i, v in enumerate(variables):
            if not isinstance(v, dict):
                errors.append(f"approved_variables[{i}] must be an object")
                continue
            vid = v.get("id")
            src = v.get("source")
            if not vid:
                errors.append(f"approved_variables[{i}] missing id")
            else:
                var_ids.add(vid)
            if not src:
                errors.append(f"approved_variables[{i}] (id={vid or '?'}) missing source")
            elif src not in ALLOWED_VARIABLE_SOURCES:
                errors.append(f"approved_variables[{i}] invalid source: {src} (not in Layer 1 allowed list)")
            norm = v.get("normalize", "min_max")
            if norm not in ALLOWED_NORMALIZE:
                errors.append(f"approved_variables[{i}] (id={vid or '?'}) invalid normalize: {norm}")
            rng = v.get("range")
            if rng is not None:
                if not isinstance(rng, (list, tuple)) or len(rng) < 2:
                    errors.append(f"approved_variables[{i}] (id={vid or '?'}) range must be [min, max]")
                else:
                    try:
                        lo, hi = float(rng[0]), float(rng[1])
                        if hi <= lo:
                            errors.append(f"approved_variables[{i}] (id={vid or '?'}) range[1] must be > range[0]")
                    except (TypeError, ValueError):
                        errors.append(f"approved_variables[{i}] (id={vid or '?'}) range values must be numbers")
    else:
        var_ids = set()

    weights = data.get("approved_weights")
    if isinstance(weights, dict) and var_ids:
        for k in weights:
            if k not in var_ids:
                errors.append(f"approved_weights key '{k}' does not match any approved_variables id")

    archetypes = data.get("approved_archetypes")
    if isinstance(archetypes, list):
        for i, a in enumerate(archetypes):
            if not isinstance(a, dict):
                errors.append(f"approved_archetypes[{i}] must be an object")
                continue
            if not a.get("code"):
                errors.append(f"approved_archetypes[{i}] missing code")
            criteria = a.get("criteria")
            if isinstance(criteria, dict):
                for field, cond in criteria.items():
                    if field not in ALLOWED_ARCHETYPE_CRITERIA_FIELDS:
                        errors.append(f"approved_archetypes[{i}] (code={a.get('code')}) criteria field not allowed: {field}")
                        continue
                    if not isinstance(cond, dict):
                        errors.append(f"approved_archetypes[{i}] (code={a.get('code')}) criteria.{field} must be object (gte/lte/between/eq)")
                        continue
                    if field in ARCHETYPE_STRING_CRITERIA_FIELDS:
                        for op in cond:
                            if op not in ("eq", "gte", "lte"):
                                errors.append(f"approved_archetypes[{i}] (code={a.get('code')}) criteria.{field} only allows eq/gte/lte")
                    else:
                        for op in cond:
                            if op not in ("gte", "lte", "between"):
                                errors.append(f"approved_archetypes[{i}] (code={a.get('code')}) criteria.{field} only allows gte/lte/between")

    rules = data.get("approved_exclusion_rules")
    if isinstance(rules, list):
        for i, r in enumerate(rules):
            if not isinstance(r, dict):
                errors.append(f"approved_exclusion_rules[{i}] must be an object")
                continue
            field = r.get("field")
            op = r.get("op")
            value = r.get("value")
            if not field:
                errors.append(f"approved_exclusion_rules[{i}] missing field")
            elif field not in ALLOWED_EXCLUSION_FIELDS:
                errors.append(f"approved_exclusion_rules[{i}] invalid field: {field}")
            if op is not None and op not in ALLOWED_EXCLUSION_OPS:
                errors.append(f"approved_exclusion_rules[{i}] invalid op: {op} (allowed: =, >=, <=, between)")
            if op == "between":
                if not isinstance(value, (list, tuple)) or len(value) < 2:
                    errors.append(f"approved_exclusion_rules[{i}] value must be [min, max] for op=between")
            elif value is not None and field in EXCLUSION_PERCENT_FIELDS:
                try:
                    float(value)
                except (TypeError, ValueError):
                    errors.append(f"approved_exclusion_rules[{i}] value for percent field {field} must be numeric (ratio)")

    prompts = data.get("approved_review_prompts")
    if prompts is not None and not isinstance(prompts, list):
        errors.append("approved_review_prompts must be an array or omitted")
    elif isinstance(prompts, list):
        for i, p in enumerate(prompts):
            if not isinstance(p, dict):
                errors.append(f"approved_review_prompts[{i}] must be an object")
            elif "id" not in p or "prompt_text" not in p:
                errors.append(f"approved_review_prompts[{i}] must have id and prompt_text")

    return errors
