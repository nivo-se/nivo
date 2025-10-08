-- Fix Supabase master_analytics table schema - Version 2
-- Problem: revenue, profit columns are DATE/TIMESTAMP instead of NUMERIC
-- Solution: Clean drop and recreate with correct types

-- Step 1: Backup existing table (optional, for safety)
CREATE TABLE IF NOT EXISTS master_analytics_backup_20251007 AS 
SELECT * FROM master_analytics;

-- Step 2: Drop ALL policies first (prevents conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON master_analytics;
DROP POLICY IF EXISTS "Enable read access for all users" ON master_analytics;

-- Step 3: Drop the incorrectly typed table (with CASCADE to remove dependencies)
DROP TABLE IF EXISTS master_analytics CASCADE;

-- Step 4: Create table with correct schema
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
    revenue DOUBLE PRECISION,
    profit DOUBLE PRECISION,
    employees INTEGER,
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

-- Step 5: Create indexes for performance
CREATE INDEX idx_master_analytics_city ON master_analytics(city);
CREATE INDEX idx_master_analytics_segment ON master_analytics(segment);
CREATE INDEX idx_master_analytics_revenue ON master_analytics(revenue);
CREATE INDEX idx_master_analytics_employees ON master_analytics(employees);
CREATE INDEX idx_master_analytics_growth_category ON master_analytics(growth_category);
CREATE INDEX idx_master_analytics_digital_presence ON master_analytics(digital_presence);

-- Step 6: Enable Row Level Security
ALTER TABLE master_analytics ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policy for public read access
CREATE POLICY "Allow public read access" ON master_analytics
    FOR SELECT
    TO public
    USING (true);

-- Verification: Check table was created successfully
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'master_analytics' 
    AND column_name IN ('revenue', 'profit', 'employees')
ORDER BY ordinal_position;

