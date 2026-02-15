-- VACUUM FULL - Reclaim space after table deletions
-- Run this SEPARATELY after supabase_cleanup.sql
-- 
-- IMPORTANT: VACUUM cannot run inside a transaction block.
-- Run this as a standalone query in Supabase SQL Editor.

-- ============================================
-- Check size BEFORE VACUUM
-- ============================================
SELECT 
    'Before VACUUM' AS status,
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    pg_database_size(current_database()) AS size_bytes;

-- ============================================
-- VACUUM FULL - Reclaim all unused space
-- ============================================
-- WARNING: This locks tables and can take time.
-- Run during low-traffic period.

VACUUM FULL;

-- ============================================
-- Check size AFTER VACUUM
-- ============================================
SELECT 
    'After VACUUM' AS status,
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    pg_database_size(current_database()) AS size_bytes;

