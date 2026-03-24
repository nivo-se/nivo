-- Exemplar Deep Research markdown chunks: links to orgnr + analysis_run for screening RAG / audit.
-- Chroma holds vectors by default; optional pgvector column when rows are embedded via indexer.

CREATE SCHEMA IF NOT EXISTS ai_ops;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_ops.exemplar_report_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    source_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    orgnr TEXT,
    analysis_run_id UUID REFERENCES deep_research.analysis_runs(id) ON DELETE SET NULL,
    manifest_version TEXT NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding vector(1536),
    CONSTRAINT uq_exemplar_report_chunks_chunk_id UNIQUE (chunk_id),
    CONSTRAINT ck_exemplar_report_chunks_chunk_index CHECK (chunk_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_exemplar_report_chunks_orgnr
    ON ai_ops.exemplar_report_chunks(orgnr)
    WHERE orgnr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exemplar_report_chunks_analysis_run
    ON ai_ops.exemplar_report_chunks(analysis_run_id)
    WHERE analysis_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exemplar_report_chunks_slug
    ON ai_ops.exemplar_report_chunks(slug);

CREATE INDEX IF NOT EXISTS idx_exemplar_report_chunks_manifest_version
    ON ai_ops.exemplar_report_chunks(manifest_version);

COMMENT ON TABLE ai_ops.exemplar_report_chunks IS
    'Screening exemplar report chunks; optional orgnr/analysis_run_id from exemplar_reports_manifest.json; vectors optional (Chroma or pgvector).';

-- Semantic search over exemplar chunks that have pgvector embeddings filled.
CREATE OR REPLACE FUNCTION ai_ops.exemplar_chunks_vector_search(
    query_embedding vector(1536),
    match_limit int DEFAULT 8,
    filter_orgnr text DEFAULT NULL
)
RETURNS TABLE (
    chunk_id text,
    content text,
    source_path text,
    slug text,
    orgnr text,
    analysis_run_id uuid,
    similarity float
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.chunk_id,
        c.content,
        c.source_path,
        c.slug,
        c.orgnr,
        c.analysis_run_id,
        (1 - (c.embedding <=> query_embedding))::float AS similarity
    FROM ai_ops.exemplar_report_chunks c
    WHERE c.embedding IS NOT NULL
      AND (filter_orgnr IS NULL OR c.orgnr = filter_orgnr)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_limit;
$$;

COMMENT ON FUNCTION ai_ops.exemplar_chunks_vector_search IS
    'Cosine similarity search over exemplar report chunks (requires embedding column populated).';
