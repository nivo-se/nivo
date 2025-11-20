-- Investigate what's taking up space in Supabase
-- Run this to find out why database is still 207 MB

-- ============================================
-- 1. Check ALL schemas (not just public/ai_ops)
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
-- 2. All tables by size (all schemas)
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 3. Check for large indexes
-- ============================================
SELECT 
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS size_bytes
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1024 * 1024  -- Larger than 1MB
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ============================================
-- 4. Check for sequences (can take space)
-- ============================================
SELECT 
    schemaname,
    sequencename,
    pg_size_pretty(pg_relation_size(schemaname||'.'||sequencename)) AS size
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(schemaname||'.'||sequencename) DESC;

-- ============================================
-- 5. Check Auth schema specifically
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 6. Check for materialized views
-- ============================================
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;

-- ============================================
-- 7. Check for TOAST tables (large data)
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE '%_toast%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 8. Database bloat (unused space after deletes)
-- ============================================
-- Note: After deleting tables, PostgreSQL doesn't immediately free space
-- You need to run VACUUM FULL to reclaim space
SELECT 
    schemaname,
    relname AS tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS current_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
    n_dead_tup AS dead_tuples,
    n_live_tup AS live_tuples
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;

-- ============================================
-- 9. Total database size breakdown
-- ============================================
SELECT 
    pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
    pg_database_size(current_database()) AS size_bytes;

-- ============================================
-- 10. RECOMMENDATION: Run VACUUM FULL
-- ============================================
-- After deleting tables, run this to reclaim space:
-- VACUUM FULL;
-- 
-- WARNING: VACUUM FULL locks tables and can take time
-- Run during low-traffic period

