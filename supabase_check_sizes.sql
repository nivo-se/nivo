-- Check Supabase Table Sizes
-- Run this FIRST to see how much space each table uses
-- This helps you understand which tables are taking up the most storage

-- ============================================
-- Table Sizes (sorted by size, largest first)
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- Total Database Size
-- ============================================
SELECT 
    pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
    pg_database_size(current_database()) AS size_bytes;

-- ============================================
-- Summary by Schema
-- ============================================
SELECT 
    schemaname,
    COUNT(*) AS table_count,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) AS total_size,
    SUM(pg_total_relation_size(schemaname||'.'||tablename)) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

-- ============================================
-- Row Counts (for reference)
-- ============================================
-- Note: This may take a while for large tables
SELECT 
    'public.companies' AS table_name,
    COUNT(*) AS row_count
FROM public.companies
UNION ALL
SELECT 
    'public.company_financials' AS table_name,
    COUNT(*) AS row_count
FROM public.company_financials
UNION ALL
SELECT 
    'public.company_metrics' AS table_name,
    COUNT(*) AS row_count
FROM public.company_metrics
UNION ALL
SELECT 
    'public.master_analytics' AS table_name,
    COUNT(*) AS row_count
FROM public.master_analytics
UNION ALL
SELECT 
    'ai_ops.company_intel' AS table_name,
    COUNT(*) AS row_count
FROM ai_ops.company_intel
UNION ALL
SELECT 
    'ai_ops.intel_artifacts' AS table_name,
    COUNT(*) AS row_count
FROM ai_ops.intel_artifacts
UNION ALL
SELECT 
    'ai_ops.ai_reports' AS table_name,
    COUNT(*) AS row_count
FROM ai_ops.ai_reports;

