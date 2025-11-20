-- Reclaim space after table deletions
-- Run this AFTER investigating with supabase_investigate_size.sql

-- ============================================
-- VACUUM FULL - Reclaim unused space
-- ============================================
-- WARNING: VACUUM FULL locks tables and can take time
-- Run during low-traffic period
-- This will reclaim space from deleted tables

VACUUM FULL;

-- ============================================
-- Check size after VACUUM
-- ============================================
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size_after_vacuum;

-- ============================================
-- Alternative: VACUUM ANALYZE (less aggressive)
-- ============================================
-- If VACUUM FULL is too slow, try this first:
-- VACUUM ANALYZE;
-- 
-- This updates statistics and marks space as reusable
-- but doesn't immediately shrink the database file

