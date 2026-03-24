"""Load exemplar_reports_manifest.json (per-company .md + optional orgnr / analysis run links)."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_MANIFEST_PATH = (
    _REPO_ROOT / "docs" / "deep_research" / "screening_exemplars" / "exemplar_reports_manifest.json"
)


class ExemplarReportEntry(TypedDict):
    slug: str
    file: str
    orgnr: Optional[str]
    analysisRunId: Optional[str]


def exemplar_reports_manifest_path() -> Path:
    return _DEFAULT_MANIFEST_PATH


@lru_cache(maxsize=1)
def load_exemplar_reports_manifest(*, path: Optional[str] = None) -> Dict[str, Any]:
    """Load exemplar_reports_manifest.json (reports list + _meta)."""
    p = Path(path) if path else _DEFAULT_MANIFEST_PATH
    if not p.is_file():
        logger.warning("Exemplar reports manifest not found at %s", p)
        return {}
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Could not load exemplar reports manifest: %s", e)
        return {}


def stable_chunk_id(manifest_version: str, slug: str, chunk_index: int) -> str:
    """Stable id for Chroma + Postgres (manifest version + slug + chunk index)."""
    return f"exemplar:{manifest_version}:{slug}:{chunk_index}"


def exemplar_manifest_version(data: Optional[Dict[str, Any]] = None) -> Optional[str]:
    d = data if data is not None else load_exemplar_reports_manifest()
    meta = d.get("_meta") if isinstance(d.get("_meta"), dict) else {}
    v = meta.get("version")
    return str(v) if v is not None else None


def list_manifest_reports(*, path: Optional[str] = None) -> List[ExemplarReportEntry]:
    """Return report entries from manifest (empty if missing)."""
    data = load_exemplar_reports_manifest(path=path)
    raw = data.get("reports")
    if not isinstance(raw, list):
        return []
    out: List[ExemplarReportEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        slug = item.get("slug")
        file_name = item.get("file")
        if not isinstance(slug, str) or not isinstance(file_name, str):
            continue
        orgnr_v = item.get("orgnr")
        run_v = item.get("analysisRunId")
        entry: ExemplarReportEntry = {
            "slug": slug,
            "file": file_name,
            "orgnr": str(orgnr_v) if orgnr_v else None,
            "analysisRunId": str(run_v) if run_v else None,
        }
        out.append(entry)
    return out


def clear_exemplar_reports_manifest_cache() -> None:
    load_exemplar_reports_manifest.cache_clear()
