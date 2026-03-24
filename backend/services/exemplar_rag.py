"""Chroma indexing + query for screening exemplar markdown chunks."""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.utils import embedding_functions

from backend.services.exemplar_chunking import chunk_exemplar_markdown
from backend.services.exemplar_manifest import (
    clear_exemplar_reports_manifest_cache,
    exemplar_manifest_version,
    exemplar_reports_manifest_path,
    list_manifest_reports,
    load_exemplar_reports_manifest,
    stable_chunk_id,
)

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
CHROMA_DB_DIR = _REPO_ROOT / "data" / "chroma_db"
COLLECTION_NAME = "nivo_exemplar_reports"


class ExemplarRAGService:
    """Persistent Chroma collection for exemplar .md chunks (OpenAI embeddings)."""

    _instance: Optional["ExemplarRAGService"] = None

    def __new__(cls) -> "ExemplarRAGService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return

        self.client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name="text-embedding-3-small",
            )
        else:
            logger.warning("OPENAI_API_KEY not set. Exemplar RAG indexing/query will fail.")
            self.embedding_fn = None

        try:
            self.collection = self.client.get_collection(name=COLLECTION_NAME)
        except Exception:
            self.collection = self.client.create_collection(
                name=COLLECTION_NAME,
                embedding_function=self.embedding_fn,
                metadata={"embedding_function": "OpenAI" if api_key else "default"},
            )

        self._initialized = True

    def index_from_manifest(
        self,
        *,
        max_chars: int = 1200,
        manifest_path: Optional[Path] = None,
    ) -> int:
        """
        Chunk all manifest-listed .md files and replace the Chroma collection contents.
        Returns number of chunks indexed.
        """
        if not self.embedding_fn:
            raise RuntimeError("OPENAI_API_KEY required for exemplar Chroma indexing")

        mp = manifest_path or exemplar_reports_manifest_path()
        clear_exemplar_reports_manifest_cache()
        data = load_exemplar_reports_manifest(path=str(mp))
        mv = exemplar_manifest_version(data) or "unknown"
        reports = list_manifest_reports(path=str(mp) if mp else None)
        if not reports:
            logger.warning("No reports in manifest; nothing to index.")
            return 0

        base_dir = mp.parent if mp else _REPO_ROOT / "docs" / "deep_research" / "screening_exemplars"

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[Dict[str, Any]] = []

        for entry in reports:
            file_name = entry["file"]
            slug = entry["slug"]
            path = base_dir / file_name
            if not path.is_file():
                logger.warning("Skipping missing exemplar file: %s", path)
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            orgnr = entry.get("orgnr") or ""
            analysis_run = entry.get("analysisRunId") or ""
            rel = str(path.relative_to(_REPO_ROOT))
            for i, chunk in enumerate(chunk_exemplar_markdown(text, max_chars=max_chars)):
                cid = stable_chunk_id(mv, slug, i)
                ids.append(cid)
                documents.append(chunk)
                metadatas.append(
                    {
                        "manifest_version": mv,
                        "slug": slug,
                        "chunk_index": i,
                        "source_path": rel,
                        "orgnr": orgnr,
                        "analysis_run_id": analysis_run,
                        "content_sha256": hashlib.sha256(chunk.encode("utf-8")).hexdigest(),
                    }
                )

        if not ids:
            return 0

        # Replace collection contents
        try:
            self.client.delete_collection(name=COLLECTION_NAME)
        except Exception as e:
            logger.debug("Could not delete collection (may not exist): %s", e)

        self.collection = self.client.create_collection(
            name=COLLECTION_NAME,
            embedding_function=self.embedding_fn,
            metadata={"embedding_function": "OpenAI"},
        )
        batch = 64
        for start in range(0, len(ids), batch):
            self.collection.add(
                ids=ids[start : start + batch],
                documents=documents[start : start + batch],
                metadatas=metadatas[start : start + batch],
            )

        logger.info("Indexed %s exemplar chunks (manifest %s).", len(ids), mv)
        return len(ids)

    def query(
        self,
        text: str,
        *,
        n_results: int = 5,
        orgnr_filter: Optional[str] = None,
    ) -> str:
        """Return concatenated chunk texts for the query (optional orgnr metadata filter)."""
        if not self.embedding_fn:
            return ""

        where: Optional[Dict[str, Any]] = None
        if orgnr_filter:
            where = {"orgnr": orgnr_filter}

        try:
            results = self.collection.query(
                query_texts=[text],
                n_results=n_results,
                where=where,
            )
            docs = results.get("documents") or []
            if not docs or not docs[0]:
                return ""
            return "\n\n".join(docs[0])
        except Exception as e:
            logger.error("Exemplar RAG query failed: %s", e)
            return ""


def get_exemplar_rag_service() -> ExemplarRAGService:
    return ExemplarRAGService()
