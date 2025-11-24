
from backend.utils.rag_service import get_rag_service

def retrieve_context(user_prompt: str, max_lines: int = 10) -> str:
    """
    Retrieves relevant context using Vector Search (ChromaDB).
    Delegates to RAGService which handles embedding and retrieval.
    """
    service = get_rag_service()
    # n_results=3 is usually enough for 3-4 chunks of context
    return service.query(user_prompt, n_results=3)
