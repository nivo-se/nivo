-- Acquisition Workflow Schema
-- New tables for the 3-stage acquisition workflow

-- Track workflow runs
CREATE TABLE IF NOT EXISTS acquisition_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    criteria JSONB NOT NULL,
    stage INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    stage1_count INTEGER,
    stage2_count INTEGER,
    stage3_count INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by TEXT,
    CONSTRAINT valid_stage CHECK (stage >= 0 AND stage <= 3),
    CONSTRAINT valid_status CHECK (status IN ('running', 'stage_1_complete', 'stage_2_complete', 'complete', 'failed'))
);

CREATE INDEX IF NOT EXISTS acquisition_runs_status_idx ON acquisition_runs(status);
CREATE INDEX IF NOT EXISTS acquisition_runs_started_at_idx ON acquisition_runs(started_at DESC);

-- Store web research data (Stage 2)
CREATE TABLE IF NOT EXISTS company_research (
    orgnr TEXT PRIMARY KEY REFERENCES companies(orgnr) ON DELETE CASCADE,
    run_id UUID REFERENCES acquisition_runs(id) ON DELETE CASCADE,
    homepage_url TEXT,
    website_content TEXT,
    about_text TEXT,
    products_text TEXT,
    search_results JSONB,
    extracted_products JSONB,
    extracted_markets JSONB,
    sales_channels TEXT[],
    digital_score INTEGER,
    scrape_success BOOLEAN DEFAULT FALSE,
    search_success BOOLEAN DEFAULT FALSE,
    researched_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_digital_score CHECK (digital_score >= 0 AND digital_score <= 100)
);

CREATE INDEX IF NOT EXISTS company_research_run_id_idx ON company_research(run_id);
CREATE INDEX IF NOT EXISTS company_research_researched_at_idx ON company_research(researched_at DESC);

-- Store AI analysis results (Stage 3)
CREATE TABLE IF NOT EXISTS company_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orgnr TEXT REFERENCES companies(orgnr) ON DELETE CASCADE,
    run_id UUID REFERENCES acquisition_runs(id) ON DELETE CASCADE,
    business_model TEXT,
    products_summary TEXT,
    market_position TEXT,
    swot_strengths TEXT[],
    swot_weaknesses TEXT[],
    swot_opportunities TEXT[],
    swot_threats TEXT[],
    strategic_fit_score INTEGER,
    recommendation TEXT,
    investment_memo TEXT,
    raw_analysis JSONB,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_strategic_fit CHECK (strategic_fit_score >= 1 AND strategic_fit_score <= 10),
    CONSTRAINT valid_recommendation CHECK (recommendation IN ('buy', 'pass', 'watch')),
    UNIQUE(orgnr, run_id)
);

CREATE INDEX IF NOT EXISTS company_analysis_run_id_idx ON company_analysis(run_id);
CREATE INDEX IF NOT EXISTS company_analysis_recommendation_idx ON company_analysis(recommendation);
CREATE INDEX IF NOT EXISTS company_analysis_strategic_fit_idx ON company_analysis(strategic_fit_score DESC);
CREATE INDEX IF NOT EXISTS company_analysis_analyzed_at_idx ON company_analysis(analyzed_at DESC);

-- Add comments for documentation
COMMENT ON TABLE acquisition_runs IS 'Tracks execution of the 3-stage acquisition workflow';
COMMENT ON TABLE company_research IS 'Stores web scraping and search results from Stage 2';
COMMENT ON TABLE company_analysis IS 'Stores AI-generated investment analysis from Stage 3';
