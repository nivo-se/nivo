-- Deep Research persistence schema (idempotent)
-- Creates dedicated schema and core tables for SQLAlchemy persistence models.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS deep_research;

-- 1) companies
CREATE TABLE IF NOT EXISTS deep_research.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orgnr TEXT NOT NULL,
    name TEXT NOT NULL,
    website TEXT,
    country_code TEXT,
    headquarters TEXT,
    industry TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_companies_orgnr UNIQUE (orgnr)
);
CREATE INDEX IF NOT EXISTS ix_dr_companies_orgnr ON deep_research.companies(orgnr);
CREATE INDEX IF NOT EXISTS ix_dr_companies_name ON deep_research.companies(name);

-- 2) analysis_runs
CREATE TABLE IF NOT EXISTS deep_research.analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    query TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_dr_analysis_runs_status CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    )
);
CREATE INDEX IF NOT EXISTS ix_dr_analysis_runs_company_status
    ON deep_research.analysis_runs(company_id, status);
CREATE INDEX IF NOT EXISTS ix_dr_analysis_runs_created_at
    ON deep_research.analysis_runs(created_at DESC);

-- 3) sources
CREATE TABLE IF NOT EXISTS deep_research.sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    url TEXT,
    author TEXT,
    published_at TIMESTAMPTZ,
    content_text TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_dr_sources_run_id ON deep_research.sources(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_sources_company_id ON deep_research.sources(company_id);
CREATE INDEX IF NOT EXISTS ix_dr_sources_source_type ON deep_research.sources(source_type);

-- 4) source_chunks
CREATE TABLE IF NOT EXISTS deep_research.source_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES deep_research.sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content_text TEXT NOT NULL,
    token_count INTEGER,
    embedding_model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_source_chunks_source_index UNIQUE (source_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS ix_dr_source_chunks_source
    ON deep_research.source_chunks(source_id);

-- 5) claims
CREATE TABLE IF NOT EXISTS deep_research.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    source_chunk_id UUID REFERENCES deep_research.source_chunks(id) ON DELETE SET NULL,
    claim_text TEXT NOT NULL,
    claim_type TEXT,
    confidence NUMERIC(5,4),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_dr_claims_confidence CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);
CREATE INDEX IF NOT EXISTS ix_dr_claims_run_id ON deep_research.claims(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_claims_company_id ON deep_research.claims(company_id);
CREATE INDEX IF NOT EXISTS ix_dr_claims_verified ON deep_research.claims(is_verified);

-- 6) company_profiles
CREATE TABLE IF NOT EXISTS deep_research.company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    summary TEXT,
    business_model TEXT,
    products_services JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer_segments JSONB NOT NULL DEFAULT '{}'::jsonb,
    geographies JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_company_profiles_run_company UNIQUE (run_id, company_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_company_profiles_company_id
    ON deep_research.company_profiles(company_id);

-- 7) market_analysis
CREATE TABLE IF NOT EXISTS deep_research.market_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    market_size TEXT,
    growth_rate TEXT,
    trends JSONB NOT NULL DEFAULT '{}'::jsonb,
    risks JSONB NOT NULL DEFAULT '{}'::jsonb,
    opportunities JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_market_analysis_run_company UNIQUE (run_id, company_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_market_analysis_company_id
    ON deep_research.market_analysis(company_id);

-- 8) competitors
CREATE TABLE IF NOT EXISTS deep_research.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    website TEXT,
    relation_score NUMERIC(5,4),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_dr_competitors_run_company
    ON deep_research.competitors(run_id, company_id);
CREATE INDEX IF NOT EXISTS ix_dr_competitors_name
    ON deep_research.competitors(competitor_name);

-- 9) competitor_profiles
CREATE TABLE IF NOT EXISTS deep_research.competitor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES deep_research.competitors(id) ON DELETE CASCADE,
    profile_text TEXT,
    strengths JSONB NOT NULL DEFAULT '{}'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '{}'::jsonb,
    differentiation JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_competitor_profiles_competitor UNIQUE (competitor_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_competitor_profiles_competitor
    ON deep_research.competitor_profiles(competitor_id);

-- 10) strategy
CREATE TABLE IF NOT EXISTS deep_research.strategy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    investment_thesis TEXT,
    acquisition_rationale TEXT,
    key_risks JSONB NOT NULL DEFAULT '{}'::jsonb,
    diligence_focus JSONB NOT NULL DEFAULT '{}'::jsonb,
    integration_themes JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_strategy_run_company UNIQUE (run_id, company_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_strategy_company_id
    ON deep_research.strategy(company_id);

-- 11) value_creation
CREATE TABLE IF NOT EXISTS deep_research.value_creation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES deep_research.strategy(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    initiatives JSONB NOT NULL DEFAULT '{}'::jsonb,
    timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
    kpis JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_value_creation_run_company UNIQUE (run_id, company_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_value_creation_company_id
    ON deep_research.value_creation(company_id);

-- 12) financial_models
CREATE TABLE IF NOT EXISTS deep_research.financial_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    model_version TEXT NOT NULL DEFAULT 'v1',
    assumption_set JSONB NOT NULL DEFAULT '{}'::jsonb,
    forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
    sensitivity JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_financial_models_run_company_version
        UNIQUE (run_id, company_id, model_version)
);
CREATE INDEX IF NOT EXISTS ix_dr_financial_models_company_id
    ON deep_research.financial_models(company_id);

-- 13) valuations
CREATE TABLE IF NOT EXISTS deep_research.valuations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_model_id UUID REFERENCES deep_research.financial_models(id) ON DELETE SET NULL,
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    enterprise_value NUMERIC(18,2),
    equity_value NUMERIC(18,2),
    valuation_range_low NUMERIC(18,2),
    valuation_range_high NUMERIC(18,2),
    currency TEXT NOT NULL DEFAULT 'SEK',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_dr_valuations_company_method
    ON deep_research.valuations(company_id, method);
CREATE INDEX IF NOT EXISTS ix_dr_valuations_run_id
    ON deep_research.valuations(run_id);

-- 14) report_versions
CREATE TABLE IF NOT EXISTS deep_research.report_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT,
    generated_by TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_dr_report_versions_status CHECK (
        status IN ('draft', 'review', 'published', 'archived')
    ),
    CONSTRAINT uq_dr_report_versions_run_company
        UNIQUE (run_id, company_id, version_number)
);
CREATE INDEX IF NOT EXISTS ix_dr_report_versions_run_status
    ON deep_research.report_versions(run_id, status);

-- 15) report_sections
CREATE TABLE IF NOT EXISTS deep_research.report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_version_id UUID NOT NULL REFERENCES deep_research.report_versions(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    heading TEXT,
    content_md TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_report_sections_version_key
        UNIQUE (report_version_id, section_key)
);
CREATE INDEX IF NOT EXISTS ix_dr_report_sections_version_order
    ON deep_research.report_sections(report_version_id, sort_order);

