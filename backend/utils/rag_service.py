
import os
import hashlib
import logging
from pathlib import Path
from typing import List, Optional

import chromadb
from chromadb.utils import embedding_functions
from openai import OpenAI

logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
RAG_FILE = PROJECT_ROOT / "data" / "rag_context.md"
CHROMA_DB_DIR = PROJECT_ROOT / "data" / "chroma_db"

class RAGService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RAGService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))
        
        # Use OpenAI embedding function
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name="text-embedding-3-small"
            )
        else:
            logger.warning("OPENAI_API_KEY not set. RAG will fail.")
            self.embedding_fn = None

        # Check if collection exists and has correct embedding function
        collection_name = "nivo_context"
        try:
            existing_collection = self.client.get_collection(name=collection_name)
            # If we have OpenAI key but collection was created without it, delete and recreate
            if api_key and existing_collection.metadata.get("embedding_function") != "OpenAI":
                logger.info("Deleting existing collection with wrong embedding function...")
                self.client.delete_collection(name=collection_name)
                existing_collection = None
        except Exception:
            existing_collection = None

        if existing_collection is None:
            # Create new collection with correct embedding function
            self.collection = self.client.create_collection(
                name=collection_name,
                embedding_function=self.embedding_fn,
                metadata={"embedding_function": "OpenAI" if api_key else "default"}
            )
        else:
            self.collection = existing_collection
        
        self._ensure_indexed()
        self._initialized = True

    def _get_file_hash(self) -> str:
        if not RAG_FILE.exists():
            return ""
        with open(RAG_FILE, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()

    def _ensure_indexed(self):
        """Check if we need to re-index the RAG file."""
        if not RAG_FILE.exists():
            return

        current_hash = self._get_file_hash()
        
        # Check stored hash (using metadata of the first item if exists)
        existing = self.collection.get(limit=1, include=["metadatas"])
        stored_hash = ""
        if existing["ids"] and existing["metadatas"]:
            stored_hash = existing["metadatas"][0].get("file_hash", "")

        if current_hash != stored_hash:
            logger.info("RAG content changed. Re-indexing...")
            self._index_content(current_hash)
        else:
            logger.info("RAG content up to date.")

    def _index_content(self, file_hash: str):
        """Read file, chunk it, and store in ChromaDB."""
        with open(RAG_FILE, "r") as f:
            content = f.read()

        # Split by H2 headers (## ) to keep sections together
        # This assumes the markdown structure is consistent
        sections = content.split("\n## ")
        
        # Re-add the "## " prefix to sections after the first one
        chunks = [sections[0]] + [f"## {s}" for s in sections[1:]]
        
        # Clear existing
        try:
            # ChromaDB doesn't have a clear() method on collection, so we delete all
            existing_ids = self.collection.get()["ids"]
            if existing_ids:
                self.collection.delete(ids=existing_ids)
        except Exception as e:
            logger.warning(f"Error clearing collection: {e}")

        # Add new chunks
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"file_hash": file_hash, "section_index": i} for i in range(len(chunks))]
        
        if chunks:
            self.collection.add(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            logger.info(f"Indexed {len(chunks)} chunks.")

    def query(self, text: str, n_results: int = 3) -> str:
        """Query the vector store for relevant context."""
        if not self.embedding_fn:
            return ""
            
        try:
            results = self.collection.query(
                query_texts=[text],
                n_results=n_results
            )
            
            # Always include the "Valid Fields" section if it's not in results
            # We identify it by content or index. 
            # Strategy: Get chunk_0 (Header + Valid Fields usually) directly.
            
            retrieved_docs = results["documents"][0]
            
            # Ensure chunk_0 is present (it contains aliases and valid fields)
            # This is a critical safeguard.
            chunk_0 = self.collection.get(ids=["chunk_0"])["documents"][0]
            
            final_docs = []
            if chunk_0 not in retrieved_docs:
                final_docs.append(chunk_0)
            
            final_docs.extend(retrieved_docs)
            
            return "\n\n".join(final_docs)
            
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            return ""

# Singleton accessor
def get_rag_service():
    return RAGService()
