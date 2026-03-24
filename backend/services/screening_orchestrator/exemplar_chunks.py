"""Read exemplar markdown chunks from Postgres (ai_ops.exemplar_report_chunks).

Indexing: ``python3 scripts/index_exemplar_markdown.py --postgres`` (optional ``--pgvector``).
See ``database/migrations/042_exemplar_report_chunks.sql``.
"""

from __future__ import annotations

from typing import Any, Dict, List


def exemplar_report_chunks_table_exists(db: Any) -> bool:
    rows = db.run_raw_query(
        """
        SELECT 1 AS ok
        FROM information_schema.tables
        WHERE table_schema = 'ai_ops' AND table_name = 'exemplar_report_chunks'
        LIMIT 1
        """
    )
    return bool(rows)


def list_chunks_for_orgnr(db: Any, orgnr: str, *, limit: int = 50) -> List[Dict[str, Any]]:
    """Return exemplar chunk rows for an orgnr (optional API / Layer 1 RAG)."""
    rows = db.run_raw_query(
        """
        SELECT chunk_id, slug, source_path, chunk_index, content AS content_text,
               orgnr, analysis_run_id::text AS analysis_run_id, manifest_version, indexed_at
        FROM ai_ops.exemplar_report_chunks
        WHERE orgnr = ?
        ORDER BY source_path, chunk_index
        LIMIT ?
        """,
        [orgnr.strip(), limit],
    )
    return [dict(r) for r in (rows or [])]
