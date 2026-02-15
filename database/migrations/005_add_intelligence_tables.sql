-- Migration: Add Intelligence Tables
-- Description: Creates tables for company intelligence, enrichment artifacts, embeddings, AI reports, and rankings
-- Run in Supabase SQL Editor

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Company intelligence table (core intelligence data)
CREATE TABLE IF NOT EXISTS ai_ops.company_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    product_taxonomy JSONB,
    customer_type TEXT,
    pricing JSONB,
    brand_positioning TEXT,
    digital_maturity_score NUMERIC,
    tech_stack_json JSONB,
    signals_json JSONB,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(orgnr)
);

CREATE INDEX IF NOT EXISTS idx_company_intel_orgnr ON ai_ops.company_intel(orgnr);
CREATE INDEX IF NOT EXISTS idx_company_intel_industry ON ai_ops.company_intel(industry);
CREATE INDEX IF NOT EXISTS idx_company_intel_updated ON ai_ops.company_intel(updated_at DESC);

-- Intelligence artifacts (raw data from sources)
CREATE TABLE IF NOT EXISTS ai_ops.intel_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    source TEXT NOT NULL, -- 'serpapi', 'builtwith', 'linkedin', 'website', etc.
    artifact_type TEXT NOT NULL, -- 'news', 'job_posting', 'review', 'tech_stack', 'seo_metrics', etc.
    url TEXT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_artifacts_orgnr ON ai_ops.intel_artifacts(orgnr, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_artifacts_type ON ai_ops.intel_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_intel_artifacts_source ON ai_ops.intel_artifacts(source);

-- Company embeddings (pgvector for semantic search)
CREATE TABLE IF NOT EXISTS ai_ops.company_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    content TEXT NOT NULL,
    source TEXT NOT NULL, -- 'website', 'news', 'review', etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_embeddings_orgnr ON ai_ops.company_embeddings(orgnr);
CREATE INDEX IF NOT EXISTS idx_company_embeddings_vector ON ai_ops.company_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AI reports (structured AI analysis)
CREATE TABLE IF NOT EXISTS ai_ops.ai_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    business_model TEXT,
    weaknesses_json JSONB,
    uplift_ops_json JSONB,
    impact_range TEXT, -- 'Low', 'Medium', 'High'
    outreach_angle TEXT,
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_orgnr ON ai_ops.ai_reports(orgnr, created_at DESC);

-- Playbooks (action plans for operational improvement)
CREATE TABLE IF NOT EXISTS ai_ops.playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    actions JSONB NOT NULL,
    owner TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'active', 'completed', 'archived'
    expected_impact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_orgnr ON ai_ops.playbooks(orgnr, status);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON ai_ops.playbooks(status, updated_at DESC);

-- Decision log (audit trail for company selection/rejection)
CREATE TABLE IF NOT EXISTS ai_ops.decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    author TEXT NOT NULL,
    note TEXT NOT NULL,
    override_delta NUMERIC, -- Manual score adjustment (-50 to +50)
    fit_score NUMERIC,
    status TEXT, -- 'selected', 'rejected', 'pending', 'on_hold'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_log_orgnr ON ai_ops.decision_log(orgnr, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_log_status ON ai_ops.decision_log(status, created_at DESC);

-- Company rankings (composite scores)
CREATE TABLE IF NOT EXISTS ai_ops.company_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    financial_score NUMERIC,
    uplift_score NUMERIC,
    strategic_fit_score NUMERIC,
    composite_score NUMERIC,
    manual_override_delta NUMERIC DEFAULT 0,
    pinned BOOLEAN DEFAULT FALSE,
    decision_status TEXT, -- 'selected', 'rejected', 'pending'
    decision_notes TEXT,
    decision_author TEXT,
    decision_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(orgnr)
);

CREATE INDEX IF NOT EXISTS idx_company_rankings_composite ON ai_ops.company_rankings(composite_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_company_rankings_pinned ON ai_ops.company_rankings(pinned, composite_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_company_rankings_status ON ai_ops.company_rankings(decision_status, composite_score DESC NULLS LAST);

-- Add comments for documentation
COMMENT ON TABLE ai_ops.company_intel IS 'Core intelligence data aggregated from multiple sources';
COMMENT ON TABLE ai_ops.intel_artifacts IS 'Raw artifacts from external sources (news, job postings, reviews, etc.)';
COMMENT ON TABLE ai_ops.company_embeddings IS 'Vector embeddings for semantic search (pgvector)';
COMMENT ON TABLE ai_ops.ai_reports IS 'Structured AI-generated analysis reports';
COMMENT ON TABLE ai_ops.playbooks IS 'Action plans for operational improvement';
COMMENT ON TABLE ai_ops.decision_log IS 'Audit trail of operator decisions and score adjustments';
COMMENT ON TABLE ai_ops.company_rankings IS 'Composite scores and ranking data for company selection';

