-- Fix Supabase master_analytics table schema
-- Problem: revenue, profit columns are DATE/TIMESTAMP instead of NUMERIC
-- Solution: Drop and recreate with correct types

-- Step 1: Backup existing table (optional, for safety)
CREATE TABLE IF NOT EXISTS master_analytics_backup_20251007 AS 
SELECT * FROM master_analytics;

-- Step 2: Drop the incorrectly typed table
DROP TABLE IF EXISTS master_analytics;

-- Step 3: Create table with correct schema
CREATE TABLE master_analytics (
    -- Primary identification
    "OrgNr" TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    city TEXT,
    incorporation_date TIMESTAMP,
    email TEXT,
    homepage TEXT,
    
    -- Segment/Industry
    segment TEXT,
    segment_name TEXT,
    
    -- Financial data (CORRECT TYPES - NUMERIC not DATE!)
    revenue DOUBLE PRECISION,  -- Changed from DATE/TIMESTAMP to DOUBLE PRECISION
    profit DOUBLE PRECISION,   -- Changed from DATE/TIMESTAMP to DOUBLE PRECISION
    employees INTEGER,         -- Changed from TEXT to INTEGER
    
    -- Financial metrics (already correct)
    "SDI" DOUBLE PRECISION,
    "DR" DOUBLE PRECISION,
    "ORS" DOUBLE PRECISION,
    "Revenue_growth" DOUBLE PRECISION,
    "EBIT_margin" DOUBLE PRECISION,
    "NetProfit_margin" DOUBLE PRECISION,
    
    -- Additional metrics
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
    
    -- Classification categories
    company_size_category TEXT,
    employee_size_category TEXT,
    profitability_category TEXT,
    growth_category TEXT,
    digital_presence BOOLEAN,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_master_analytics_city ON master_analytics(city);
CREATE INDEX idx_master_analytics_segment ON master_analytics(segment);
CREATE INDEX idx_master_analytics_revenue ON master_analytics(revenue);
CREATE INDEX idx_master_analytics_employees ON master_analytics(employees);
CREATE INDEX idx_master_analytics_growth_category ON master_analytics(growth_category);
CREATE INDEX idx_master_analytics_digital_presence ON master_analytics(digital_presence);

-- Step 5: Enable Row Level Security (RLS) if needed
ALTER TABLE master_analytics ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policy for public read access (adjust based on your security needs)
CREATE POLICY "Allow public read access" ON master_analytics
    FOR SELECT
    TO public
    USING (true);

-- Verification queries to run after migration:
-- SELECT COUNT(*) FROM master_analytics;
-- SELECT COUNT(*) FROM master_analytics WHERE revenue IS NOT NULL;
-- SELECT COUNT(*) FROM master_analytics WHERE profit IS NOT NULL;
-- SELECT name, revenue, profit, employees FROM master_analytics LIMIT 5;

