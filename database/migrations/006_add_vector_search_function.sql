-- Migration: Add Vector Search Function
-- Description: Creates pgvector similarity search function for semantic search
-- Run in Supabase SQL Editor

-- Vector similarity search function
CREATE OR REPLACE FUNCTION ai_ops.vector_search(
    query_embedding vector(1536),
    target_orgnr text,
    match_limit int DEFAULT 5
)
RETURNS TABLE (
    chunk_id text,
    content text,
    source text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.chunk_id,
        ce.content,
        ce.source,
        1 - (ce.embedding <=> query_embedding) as similarity
    FROM ai_ops.company_embeddings ce
    WHERE ce.orgnr = target_orgnr
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

-- Add comment
COMMENT ON FUNCTION ai_ops.vector_search IS 'Semantic search within a company''s documents using cosine similarity';

