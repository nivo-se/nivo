#!/usr/bin/env python3
"""
Chunk exemplar markdown (manifest-driven), optional JSONL export, Chroma indexing, Postgres rows.

Examples:
  python3 scripts/index_exemplar_markdown.py --jsonl /tmp/exemplar_chunks.jsonl
  python3 scripts/index_exemplar_markdown.py --chroma
  python3 scripts/index_exemplar_markdown.py --postgres
  python3 scripts/index_exemplar_markdown.py --postgres --pgvector   # fill ai_ops.exemplar_report_chunks.embedding

Requires OPENAI_API_KEY for --chroma and --pgvector. Postgres uses DATABASE_URL or POSTGRES_*.
Apply migration: database/migrations/042_exemplar_report_chunks.sql
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_DEFAULT_DIR = _REPO_ROOT / "docs" / "deep_research" / "screening_exemplars"


def _connect_pg():
    try:
        import psycopg2
    except ImportError:
        print("psycopg2-binary required for --postgres", file=sys.stderr)
        sys.exit(1)

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=15)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=15,
    )


def _parse_uuid(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    try:
        return str(uuid.UUID(s))
    except (ValueError, TypeError):
        return None


def _vector_literal(vec: Sequence[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in vec) + "]"


def _embed_batch_openai(texts: List[str], model: str) -> List[List[float]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY required for embeddings")
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    out: List[List[float]] = []
    batch_size = 64
    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        resp = client.embeddings.create(model=model, input=chunk)
        for item in resp.data:
            out.append(list(item.embedding))
    return out


def _build_rows_from_manifest(
    *,
    base_dir: Path,
    max_chars: int,
    manifest_path: Path,
) -> Tuple[str, List[Dict[str, Any]]]:
    from backend.services.exemplar_chunking import chunk_exemplar_markdown
    from backend.services.exemplar_manifest import (
        clear_exemplar_reports_manifest_cache,
        exemplar_manifest_version,
        list_manifest_reports,
        load_exemplar_reports_manifest,
    )
    from backend.services.exemplar_manifest import stable_chunk_id

    clear_exemplar_reports_manifest_cache()
    data = load_exemplar_reports_manifest(path=str(manifest_path))
    mv = exemplar_manifest_version(data) or "unknown"
    reports = list_manifest_reports(path=str(manifest_path))
    rows: List[Dict[str, Any]] = []

    for entry in reports:
        path = base_dir / entry["file"]
        if not path.is_file():
            print(f"Warning: missing file {path}", file=sys.stderr)
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = str(path.relative_to(_REPO_ROOT))
        slug = entry["slug"]
        orgnr = entry.get("orgnr")
        run_raw = entry.get("analysisRunId")
        run_id = _parse_uuid(run_raw) if run_raw else None
        for i, chunk in enumerate(chunk_exemplar_markdown(text, max_chars=max_chars)):
            cid = stable_chunk_id(mv, slug, i)
            rows.append(
                {
                    "chunk_id": cid,
                    "slug": slug,
                    "source_path": rel,
                    "chunk_index": i,
                    "content": chunk,
                    "orgnr": orgnr,
                    "analysis_run_id": run_id,
                    "manifest_version": mv,
                }
            )
    return mv, rows


def _write_jsonl(rows: List[Dict[str, Any]], out: Path) -> None:
    with open(out, "w", encoding="utf-8") as fout:
        for r in rows:
            line = {
                "chunk_id": r["chunk_id"],
                "source_path": r["source_path"],
                "chunk_index": r["chunk_index"],
                "text": r["content"],
                "orgnr": r.get("orgnr"),
                "analysis_run_id": r.get("analysis_run_id"),
                "manifest_version": r["manifest_version"],
            }
            fout.write(json.dumps(line, ensure_ascii=False) + "\n")


def _upsert_postgres(
    rows: List[Dict[str, Any]],
    *,
    pgvector: bool,
    embedding_model: str,
) -> None:
    if not rows:
        print("No rows to upsert.")
        return

    embeddings: Optional[List[List[float]]] = None
    if pgvector:
        embeddings = _embed_batch_openai([r["content"] for r in rows], embedding_model)

    conn = _connect_pg()
    try:
        with conn.cursor() as cur:
            for i, r in enumerate(rows):
                emb_lit: Optional[str] = None
                if embeddings is not None:
                    emb_lit = _vector_literal(embeddings[i])

                if emb_lit is None:
                    cur.execute(
                        """
                        INSERT INTO ai_ops.exemplar_report_chunks (
                            chunk_id, slug, source_path, chunk_index, content,
                            orgnr, analysis_run_id, manifest_version, indexed_at, embedding
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NULL)
                        ON CONFLICT (chunk_id) DO UPDATE SET
                            slug = EXCLUDED.slug,
                            source_path = EXCLUDED.source_path,
                            chunk_index = EXCLUDED.chunk_index,
                            content = EXCLUDED.content,
                            orgnr = EXCLUDED.orgnr,
                            analysis_run_id = EXCLUDED.analysis_run_id,
                            manifest_version = EXCLUDED.manifest_version,
                            indexed_at = NOW(),
                            embedding = COALESCE(
                                EXCLUDED.embedding,
                                ai_ops.exemplar_report_chunks.embedding
                            )
                        """,
                        (
                            r["chunk_id"],
                            r["slug"],
                            r["source_path"],
                            r["chunk_index"],
                            r["content"],
                            r.get("orgnr"),
                            r.get("analysis_run_id"),
                            r["manifest_version"],
                        ),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO ai_ops.exemplar_report_chunks (
                            chunk_id, slug, source_path, chunk_index, content,
                            orgnr, analysis_run_id, manifest_version, indexed_at, embedding
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s::vector)
                        ON CONFLICT (chunk_id) DO UPDATE SET
                            slug = EXCLUDED.slug,
                            source_path = EXCLUDED.source_path,
                            chunk_index = EXCLUDED.chunk_index,
                            content = EXCLUDED.content,
                            orgnr = EXCLUDED.orgnr,
                            analysis_run_id = EXCLUDED.analysis_run_id,
                            manifest_version = EXCLUDED.manifest_version,
                            indexed_at = NOW(),
                            embedding = COALESCE(
                                EXCLUDED.embedding,
                                ai_ops.exemplar_report_chunks.embedding
                            )
                        """,
                        (
                            r["chunk_id"],
                            r["slug"],
                            r["source_path"],
                            r["chunk_index"],
                            r["content"],
                            r.get("orgnr"),
                            r.get("analysis_run_id"),
                            r["manifest_version"],
                            emb_lit,
                        ),
                    )
        conn.commit()
    finally:
        conn.close()

    print(f"Upserted {len(rows)} rows into ai_ops.exemplar_report_chunks (pgvector={pgvector}).")


def main() -> None:
    ap = argparse.ArgumentParser(description="Chunk and index screening exemplar markdown.")
    ap.add_argument(
        "--dir",
        type=Path,
        default=_DEFAULT_DIR,
        help="Directory containing exemplar markdown and manifest",
    )
    ap.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Path to exemplar_reports_manifest.json (default: <dir>/exemplar_reports_manifest.json)",
    )
    ap.add_argument("--jsonl", type=Path, default=None, help="Write JSONL chunks to this path")
    ap.add_argument("--max-chars", type=int, default=1200, help="Soft max chunk size")
    ap.add_argument(
        "--chroma",
        action="store_true",
        help="Index/replace Chroma collection nivo_exemplar_reports",
    )
    ap.add_argument(
        "--postgres",
        action="store_true",
        help="Upsert rows into ai_ops.exemplar_report_chunks (links orgnr/analysis_run_id)",
    )
    ap.add_argument(
        "--pgvector",
        action="store_true",
        help="With --postgres, compute OpenAI embeddings and store in embedding column",
    )
    ap.add_argument(
        "--embedding-model",
        default="text-embedding-3-small",
        help="OpenAI embedding model for --pgvector",
    )
    args = ap.parse_args()

    base_dir: Path = args.dir
    manifest_path = args.manifest or (base_dir / "exemplar_reports_manifest.json")

    mv, rows = _build_rows_from_manifest(
        base_dir=base_dir,
        max_chars=args.max_chars,
        manifest_path=manifest_path,
    )

    if args.jsonl:
        _write_jsonl(rows, args.jsonl)
        print(f"Wrote {len(rows)} chunks (manifest {mv}) to {args.jsonl}")

    if args.chroma:
        from backend.services.exemplar_rag import get_exemplar_rag_service

        n = get_exemplar_rag_service().index_from_manifest(
            max_chars=args.max_chars,
            manifest_path=manifest_path,
        )
        print(f"Chroma: indexed {n} chunks.")

    if args.postgres:
        _upsert_postgres(rows, pgvector=args.pgvector, embedding_model=args.embedding_model)

    if not args.jsonl and not args.chroma and not args.postgres:
        ap.print_help()
        print("\nSpecify at least one of: --jsonl PATH, --chroma, --postgres", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
