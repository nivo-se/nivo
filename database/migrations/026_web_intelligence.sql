-- Web intelligence tables for Deep Research Workstream 2
-- web_search_sessions, web_evidence, web_evidence_rejected

CREATE TABLE IF NOT EXISTS deep_research.web_search_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    query_group TEXT NOT NULL,
    queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider TEXT NOT NULL DEFAULT 'tavily',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_dr_web_search_sessions_run
    ON deep_research.web_search_sessions(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_web_search_sessions_company
    ON deep_research.web_search_sessions(company_id);

CREATE TABLE IF NOT EXISTS deep_research.web_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    session_id UUID REFERENCES deep_research.web_search_sessions(id) ON DELETE SET NULL,
    source_id UUID REFERENCES deep_research.sources(id) ON DELETE SET NULL,
    claim TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    value TEXT,
    unit TEXT,
    source_url TEXT,
    source_title TEXT,
    source_domain TEXT,
    source_type TEXT,
    retrieved_at TIMESTAMPTZ,
    supporting_text TEXT,
    confidence NUMERIC(5,4),
    overall_score NUMERIC(5,4),
    verification_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_dr_web_evidence_run ON deep_research.web_evidence(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_web_evidence_company ON deep_research.web_evidence(company_id);
CREATE INDEX IF NOT EXISTS ix_dr_web_evidence_session ON deep_research.web_evidence(session_id);

CREATE TABLE IF NOT EXISTS deep_research.web_evidence_rejected (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    rejection_reason TEXT NOT NULL,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_dr_web_evidence_rejected_run
    ON deep_research.web_evidence_rejected(run_id);
