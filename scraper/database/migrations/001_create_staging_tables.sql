-- Create enhanced staging jobs table
CREATE TABLE IF NOT EXISTS scraper_staging_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  filter_hash TEXT NOT NULL,
  params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT NOT NULL DEFAULT 'stage1_segmentation',
  last_page INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  migration_status TEXT DEFAULT 'pending',
  rate_limit_stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced staging companies table
CREATE TABLE IF NOT EXISTS scraper_staging_companies (
  orgnr TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_id TEXT,
  company_id_hint TEXT,
  homepage TEXT,
  nace_categories JSONB DEFAULT '[]'::jsonb,
  segment_name JSONB DEFAULT '[]'::jsonb,
  revenue_sek NUMERIC,
  profit_sek NUMERIC,
  foundation_year INTEGER,
  company_accounts_last_year TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id UUID NOT NULL REFERENCES scraper_staging_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  last_processed_at TIMESTAMP WITH TIME ZONE,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced staging company IDs table
CREATE TABLE IF NOT EXISTS scraper_staging_company_ids (
  orgnr TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'scraper',
  confidence_score TEXT DEFAULT '1.0',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id UUID NOT NULL REFERENCES scraper_staging_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  last_processed_at TIMESTAMP WITH TIME ZONE,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staging financials table
CREATE TABLE IF NOT EXISTS scraper_staging_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  orgnr TEXT NOT NULL,
  year INTEGER NOT NULL,
  period TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  currency TEXT DEFAULT 'SEK',
  -- Financial account codes
  sdi NUMERIC,  -- Revenue
  dr NUMERIC,   -- Net profit
  ors NUMERIC,  -- EBITDA
  ek NUMERIC,   -- Equity
  adi NUMERIC,
  adk NUMERIC,
  adr NUMERIC,
  ak NUMERIC,
  ant NUMERIC,
  fi NUMERIC,
  fk NUMERIC,
  gg NUMERIC,
  kbp NUMERIC,
  lg NUMERIC,
  rg NUMERIC,
  sap NUMERIC,
  sed NUMERIC,
  si NUMERIC,
  sek NUMERIC,
  sf NUMERIC,
  sfa NUMERIC,
  sge NUMERIC,
  sia NUMERIC,
  sik NUMERIC,
  skg NUMERIC,
  skgki NUMERIC,
  sko NUMERIC,
  slg NUMERIC,
  som NUMERIC,
  sub NUMERIC,
  sv NUMERIC,
  svd NUMERIC,
  utr NUMERIC,
  fsd NUMERIC,
  kb NUMERIC,
  awa NUMERIC,
  iac NUMERIC,
  min NUMERIC,
  be NUMERIC,
  tr NUMERIC,
  -- Additional fields
  raw_data JSONB NOT NULL,
  validation_status TEXT DEFAULT 'pending',
  validation_errors JSONB,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id UUID NOT NULL REFERENCES scraper_staging_jobs(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, year)
);

-- Create checkpoints table for resume capability
CREATE TABLE IF NOT EXISTS scraper_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scraper_staging_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  last_processed_page INTEGER,
  last_processed_company TEXT,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  checkpoint_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, stage)
);

-- Create migration log table
CREATE TABLE IF NOT EXISTS migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scraper_staging_jobs(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  validation_errors JSONB,
  migration_report JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scraper_staging_jobs_status ON scraper_staging_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_jobs_stage ON scraper_staging_jobs(stage);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_companies_job_id ON scraper_staging_companies(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_companies_status ON scraper_staging_companies(status);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_company_ids_job_id ON scraper_staging_company_ids(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_company_ids_status ON scraper_staging_company_ids(status);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_financials_job_id ON scraper_staging_financials(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_financials_company_id ON scraper_staging_financials(company_id);
CREATE INDEX IF NOT EXISTS idx_scraper_staging_financials_validation_status ON scraper_staging_financials(validation_status);
CREATE INDEX IF NOT EXISTS idx_scraper_checkpoints_job_id ON scraper_checkpoints(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_job_id ON migration_log(job_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_scraper_staging_jobs_updated_at BEFORE UPDATE ON scraper_staging_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraper_staging_companies_updated_at BEFORE UPDATE ON scraper_staging_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraper_staging_company_ids_updated_at BEFORE UPDATE ON scraper_staging_company_ids FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraper_staging_financials_updated_at BEFORE UPDATE ON scraper_staging_financials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraper_checkpoints_updated_at BEFORE UPDATE ON scraper_checkpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
