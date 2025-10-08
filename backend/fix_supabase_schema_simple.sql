-- Simplified approach: Just drop and recreate the table
-- Run this in Supabase SQL Editor

-- Backup first (optional but recommended)
CREATE TABLE IF NOT EXISTS master_analytics_backup_20251007 AS 
SELECT * FROM master_analytics;

-- Clean drop (removes all dependencies)
DROP TABLE IF EXISTS master_analytics CASCADE;

-- Recreate with correct types
CREATE TABLE master_analytics (
    "OrgNr" TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    city TEXT,
    incorporation_date TIMESTAMP,
    email TEXT,
    homepage TEXT,
    segment TEXT,
    segment_name TEXT,
    revenue DOUBLE PRECISION,  -- FIXED: was DATE/TIMESTAMP
    profit DOUBLE PRECISION,   -- FIXED: was DATE/TIMESTAMP
    employees INTEGER,         -- FIXED: was TEXT
    "SDI" DOUBLE PRECISION,
    "DR" DOUBLE PRECISION,
    "ORS" DOUBLE PRECISION,
    "Revenue_growth" DOUBLE PRECISION,
    "EBIT_margin" DOUBLE PRECISION,
    "NetProfit_margin" DOUBLE PRECISION,
    analysis_year INTEGER,
    seg_revenue DOUBLE PRECISION,
    seg_ebit DOUBLE PRECISION,
    year_rank INTEGER,
    avg_growth DOUBLE PRECISION,
    growth_range TEXT,
    growth_stage TEXT,
    digital_maturity TEXT,
    industry_cluster TEXT,
    fit_score_reason TEXT,
    company_size_category TEXT,
    employee_size_category TEXT,
    profitability_category TEXT,
    growth_category TEXT,
    digital_presence BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_master_analytics_city ON master_analytics(city);
CREATE INDEX idx_master_analytics_segment ON master_analytics(segment);
CREATE INDEX idx_master_analytics_revenue ON master_analytics(revenue);

-- Enable RLS
ALTER TABLE master_analytics ENABLE ROW LEVEL SECURITY;

-- Add policy
CREATE POLICY "Allow public read access" ON master_analytics
    FOR SELECT TO public USING (true);

