-- Quick check: What's taking up 189 MB?
-- Run these queries one at a time to identify the culprit

-- ============================================
-- 1. Check ALL schemas and their sizes
-- ============================================
SELECT 
    schemaname,
    COUNT(*) AS table_count,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) AS total_size,
    SUM(pg_total_relation_size(schemaname||'.'||tablename)) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

-- ============================================
-- 2. Top 10 largest tables
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- ============================================
-- 3. Auth schema breakdown
-- ============================================
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('auth.'||tablename)) AS total_size,
    pg_total_relation_size('auth.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY pg_total_relation_size('auth.'||tablename) DESC;

-- ============================================
-- 4. Check for any remaining public tables
-- ============================================
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================
-- 5. Check storage schema (Supabase internal)
-- ============================================
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('storage.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'storage'
ORDER BY pg_total_relation_size('storage.'||tablename) DESC;

-- ============================================
-- 6. Check installed extensions
-- ============================================
-- Extensions don't take significant space, but good to know what's installed
SELECT 
    extname,
    extversion,
    nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname IN ('vector', 'pgcrypto', 'uuid-ossp', 'pg_stat_statements')
ORDER BY extname;

