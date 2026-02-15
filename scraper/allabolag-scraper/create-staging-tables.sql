-- Create staging tables for the scraper
-- These tables are used for temporary data storage during scraping

-- Create scraper_staging_jobs table
CREATE TABLE IF NOT EXISTS scraper_staging_jobs (
  id VARCHAR(36) PRIMARY KEY,
  job_type VARCHAR(32) NOT NULL,
  filter_hash VARCHAR(64) NOT NULL,
  params JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  last_page INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  error TEXT,
  migration_status VARCHAR(20) DEFAULT 'pending',
  migration_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create scraper_staging_companies table
CREATE TABLE IF NOT EXISTS scraper_staging_companies (
  orgnr VARCHAR(16) PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_id VARCHAR(32),
  company_id_hint VARCHAR(32),
  homepage TEXT,
  nace_categories JSONB DEFAULT '[]',
  segment_name JSONB DEFAULT '[]',
  revenue_sek INTEGER,
  profit_sek INTEGER,
  foundation_year INTEGER,
  company_accounts_last_year VARCHAR(8),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id VARCHAR(36),
  status VARCHAR(20) DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create scraper_staging_company_ids table
CREATE TABLE IF NOT EXISTS scraper_staging_company_ids (
  orgnr VARCHAR(16) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'scraper',
  confidence_score VARCHAR(5) DEFAULT '1.0',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id VARCHAR(36),
  status VARCHAR(20) DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scraper_staging_jobs_status ON scraper_staging_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_jobs_filter_hash ON scraper_staging_jobs(filter_hash);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_companies_job_id ON scraper_staging_companies(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_companies_status ON scraper_staging_companies(status);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_company_ids_job_id ON scraper_staging_company_ids(job_id);

-- Enable RLS (Row Level Security) for these tables
ALTER TABLE scraper_staging_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_staging_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_staging_company_ids ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (we can make them more restrictive later)
CREATE POLICY "Allow all operations on scraper_staging_jobs" ON scraper_staging_jobs
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on scraper_staging_companies" ON scraper_staging_companies
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on scraper_staging_company_ids" ON scraper_staging_company_ids
  FOR ALL USING (true);
