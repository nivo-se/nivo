-- Workstream 3: Competitor Intelligence + Market Synthesis
-- competitor_candidates, market_models, positioning_analyses, market_syntheses

CREATE TABLE IF NOT EXISTS deep_research.competitor_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    candidate_type TEXT NOT NULL DEFAULT 'adjacent',
    inclusion_rationale TEXT,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_dr_competitor_candidates_run
    ON deep_research.competitor_candidates(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_competitor_candidates_company
    ON deep_research.competitor_candidates(company_id);

CREATE TABLE IF NOT EXISTS deep_research.market_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    market_label TEXT NOT NULL,
    market_subsegment TEXT,
    geography_scope TEXT,
    customer_segment TEXT,
    buying_model TEXT,
    demand_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
    market_growth_signal TEXT,
    concentration_signal TEXT,
    fragmentation_signal TEXT,
    market_maturity_signal TEXT,
    cyclicality_signal TEXT,
    regulatory_signal TEXT,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dr_market_models_run_company
    ON deep_research.market_models(run_id, company_id);
CREATE INDEX IF NOT EXISTS ix_dr_market_models_run
    ON deep_research.market_models(run_id);

CREATE TABLE IF NOT EXISTS deep_research.positioning_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    differentiated_axes JSONB NOT NULL DEFAULT '[]'::jsonb,
    parity_axes JSONB NOT NULL DEFAULT '[]'::jsonb,
    disadvantage_axes JSONB NOT NULL DEFAULT '[]'::jsonb,
    unclear_axes JSONB NOT NULL DEFAULT '[]'::jsonb,
    positioning_summary TEXT,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dr_positioning_analyses_run_company
    ON deep_research.positioning_analyses(run_id, company_id);
CREATE INDEX IF NOT EXISTS ix_dr_positioning_analyses_run
    ON deep_research.positioning_analyses(run_id);

CREATE TABLE IF NOT EXISTS deep_research.market_syntheses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
    market_attractiveness_score NUMERIC(5,4),
    competition_intensity_score NUMERIC(5,4),
    niche_defensibility_score NUMERIC(5,4),
    growth_support_score NUMERIC(5,4),
    synthesis_summary TEXT NOT NULL,
    key_supporting_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_uncertainties JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dr_market_syntheses_run_company
    ON deep_research.market_syntheses(run_id, company_id);
CREATE INDEX IF NOT EXISTS ix_dr_market_syntheses_run
    ON deep_research.market_syntheses(run_id);
