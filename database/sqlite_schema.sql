-- SQLite Schema for Acquisition Workflow

-- 1. Companies master table
CREATE TABLE IF NOT EXISTS companies (
    orgnr TEXT PRIMARY KEY,
    company_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    company_type TEXT,
    homepage TEXT,
    email TEXT,
    phone TEXT,
    address TEXT, -- JSON
    segment_names TEXT, -- JSON
    nace_codes TEXT, -- JSON
    foundation_year INTEGER,
    employees_latest INTEGER,
    accounts_last_year TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Derived metrics per company
CREATE TABLE IF NOT EXISTS company_metrics (
    orgnr TEXT PRIMARY KEY REFERENCES companies(orgnr) ON DELETE CASCADE,
    latest_year INTEGER,
    latest_revenue_sek REAL,
    latest_profit_sek REAL,
    latest_ebitda_sek REAL,
    revenue_cagr_3y REAL,
    revenue_cagr_5y REAL,
    avg_ebitda_margin REAL,
    avg_net_margin REAL,
    equity_ratio_latest REAL,
    debt_to_equity_latest REAL,
    revenue_per_employee REAL,
    ebitda_per_employee REAL,
    digital_presence BOOLEAN,
    company_size_bucket TEXT,
    growth_bucket TEXT,
    profitability_bucket TEXT,
    calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    source_job_id TEXT
);

-- 3. Acquisition Runs
CREATE TABLE IF NOT EXISTS acquisition_runs (
    id TEXT PRIMARY KEY, -- UUID
    criteria TEXT NOT NULL, -- JSON
    stage INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    stage1_count INTEGER,
    stage2_count INTEGER,
    stage3_count INTEGER,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT,
    created_by TEXT
);

-- 4. Company Research (Stage 2)
CREATE TABLE IF NOT EXISTS company_research (
    orgnr TEXT PRIMARY KEY REFERENCES companies(orgnr) ON DELETE CASCADE,
    run_id TEXT REFERENCES acquisition_runs(id) ON DELETE CASCADE,
    homepage_url TEXT,
    website_content TEXT,
    about_text TEXT,
    products_text TEXT,
    search_results TEXT, -- JSON
    extracted_products TEXT, -- JSON
    extracted_markets TEXT, -- JSON
    sales_channels TEXT, -- JSON array
    digital_score INTEGER,
    scrape_success BOOLEAN DEFAULT 0,
    search_success BOOLEAN DEFAULT 0,
    researched_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5. Company Analysis (Stage 3)
CREATE TABLE IF NOT EXISTS company_analysis (
    id TEXT PRIMARY KEY, -- UUID
    orgnr TEXT REFERENCES companies(orgnr) ON DELETE CASCADE,
    run_id TEXT REFERENCES acquisition_runs(id) ON DELETE CASCADE,
    business_model TEXT,
    products_summary TEXT,
    market_position TEXT,
    swot_strengths TEXT, -- JSON array
    swot_weaknesses TEXT, -- JSON array
    swot_opportunities TEXT, -- JSON array
    swot_threats TEXT, -- JSON array
    strategic_fit_score INTEGER,
    recommendation TEXT,
    investment_memo TEXT,
    raw_analysis TEXT, -- JSON
    analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(orgnr, run_id)
);
