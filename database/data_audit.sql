-- Data Audit: Check what tables exist and what data they contain
-- Run this in Supabase SQL Editor to understand the current data structure

-- 1. List all tables in the public schema
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Check if master_analytics table exists and what columns it has
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'master_analytics'
ORDER BY ordinal_position;

-- 3. Check if company_accounts_by_id table exists and what columns it has
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'company_accounts_by_id'
ORDER BY ordinal_position;

-- 4. Check if company_kpis_by_id table exists and what columns it has
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'company_kpis_by_id'
ORDER BY ordinal_position;

-- 5. Sample data from master_analytics (if it exists)
SELECT * FROM master_analytics WHERE "OrgNr" = '5562642362' LIMIT 1;

-- 6. Sample data from company_accounts_by_id (if it exists)
SELECT * FROM company_accounts_by_id WHERE "organisationNumber" = '5562642362' LIMIT 1;

-- 7. Sample data from company_kpis_by_id (if it exists)
SELECT * FROM company_kpis_by_id WHERE "OrgNr" = '5562642362' LIMIT 1;

-- 8. Count records in each table
SELECT 
    'master_analytics' as table_name,
    COUNT(*) as record_count
FROM master_analytics
UNION ALL
SELECT 
    'company_accounts_by_id' as table_name,
    COUNT(*) as record_count
FROM company_accounts_by_id
UNION ALL
SELECT 
    'company_kpis_by_id' as table_name,
    COUNT(*) as record_count
FROM company_kpis_by_id;
