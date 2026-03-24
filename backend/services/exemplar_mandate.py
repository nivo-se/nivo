"""Load structured screening mandate from docs/deep_research/screening_exemplars/screening_output.json."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_MANDATE_PATH = (
    _REPO_ROOT / "docs" / "deep_research" / "screening_exemplars" / "screening_output.json"
)


def exemplar_mandate_path() -> Path:
    """Absolute path to screening_output.json (for tests / diagnostics)."""
    return _DEFAULT_MANDATE_PATH


@lru_cache(maxsize=1)
def load_screening_exemplar_mandate(*, path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load exemplar synthesis JSON (common_patterns, archetypes, investment_playbook, _meta, …).

    Cached in-process. Pass ``path`` only in tests (clears cache if you need to swap files).
    """
    p = Path(path) if path else _DEFAULT_MANDATE_PATH
    if not p.is_file():
        logger.warning("Screening exemplar mandate not found at %s", p)
        return {}
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Could not load screening exemplar mandate: %s", e)
        return {}


def exemplar_mandate_version(data: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Return _meta.version from mandate dict, or None."""
    d = data if data is not None else load_screening_exemplar_mandate()
    meta = d.get("_meta") if isinstance(d.get("_meta"), dict) else {}
    v = meta.get("version")
    return str(v) if v is not None else None


def mandate_text_for_prompt(*, max_chars: int = 12000) -> str:
    """
    JSON (minus _meta) for LLM system prompts — versioned mandate text.
    Truncates long files to keep batch prompts bounded.
    """
    data = load_screening_exemplar_mandate()
    body = {k: v for k, v in data.items() if k != "_meta"}
    s = json.dumps(body, ensure_ascii=False, indent=2)
    if len(s) > max_chars:
        s = s[:max_chars] + "\n… [truncated]"
    v = exemplar_mandate_version(data)
    ver = f"v{v}" if v else "unknown"
    return f"screening_output.json ({ver})\n\n{s}"


def clear_mandate_cache() -> None:
    """Invalidate cached mandate (for tests)."""
    load_screening_exemplar_mandate.cache_clear()
