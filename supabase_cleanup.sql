-- Supabase Table Cleanup Script
-- Generated to reduce database storage
-- Review carefully before executing!
--
-- WARNING: This will permanently delete tables and all their data!
-- Make sure you have backups if needed.
--
-- Tables being deleted:
--   ALL tables except Auth tables (managed by Supabase)
--   - company_financials (LARGE - historical financial data)
--   - master_analytics (OLD - deprecated table)
--   - company_accounts_by_id (OLD - deprecated table)
--   - companies (core data - will be rebuilt)
--   - company_metrics (KPI data - will be rebuilt)
--   - stage1_shortlists (shortlists - will be rebuilt)
--   - stage2_shortlists (shortlists - will be rebuilt)
--   - saved_company_lists (user lists - will be rebuilt)
--   - All ai_ops tables (intelligence data - will be rebuilt)

-- ============================================
-- STEP 1: Check current table sizes
-- ============================================
-- Run this first to see how much space each table uses:
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- STEP 2: TABLES TO DELETE (Large/Old tables)
-- ============================================

-- Schema: public
-- ALL tables will be deleted - rebuilding entire backend:

-- Large/Old tables:
DROP TABLE IF EXISTS public.company_financials CASCADE;  -- Historical financials (LARGE)
DROP TABLE IF EXISTS public.master_analytics CASCADE;     -- Old deprecated table
DROP TABLE IF EXISTS public.company_accounts_by_id CASCADE; -- Old deprecated table

-- Core tables (will be rebuilt with new structure):
DROP TABLE IF EXISTS public.companies CASCADE;  -- Core company data
DROP TABLE IF EXISTS public.company_metrics CASCADE;  -- KPI data
DROP TABLE IF EXISTS public.stage1_shortlists CASCADE;  -- Shortlists
DROP TABLE IF EXISTS public.stage2_shortlists CASCADE;  -- Shortlists
DROP TABLE IF EXISTS public.saved_company_lists CASCADE;  -- User lists

-- AI Analysis tables (will be rebuilt):
DROP TABLE IF EXISTS public.ai_analysis_audit CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_feedback CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_metrics CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_runs CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_sections CASCADE;
DROP TABLE IF EXISTS public.ai_company_analysis CASCADE;
DROP TABLE IF EXISTS public.ai_screening_results CASCADE;

-- Financial accounts tables (will be rebuilt):
DROP TABLE IF EXISTS public.financial_accounts CASCADE;
DROP TABLE IF EXISTS public.financial_accounts_pivot CASCADE;

-- Valuation tables (will be rebuilt):
DROP TABLE IF EXISTS public.valuation_assumptions CASCADE;
DROP TABLE IF EXISTS public.valuation_models CASCADE;
DROP TABLE IF EXISTS public.valuation_results CASCADE;
DROP TABLE IF EXISTS public.valuation_runs CASCADE;
DROP TABLE IF EXISTS public.valuation_sessions CASCADE;

-- User/roles tables (will be rebuilt):
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Schema: ai_ops
-- ALL AI/Intelligence tables and functions - will be rebuilt with new structure:
-- Delete all tables in ai_ops schema
DROP TABLE IF EXISTS ai_ops.company_intel CASCADE;
DROP TABLE IF EXISTS ai_ops.intel_artifacts CASCADE;
DROP TABLE IF EXISTS ai_ops.company_embeddings CASCADE;
DROP TABLE IF EXISTS ai_ops.ai_reports CASCADE;
DROP TABLE IF EXISTS ai_ops.company_rankings CASCADE;
DROP TABLE IF EXISTS ai_ops.playbooks CASCADE;
DROP TABLE IF EXISTS ai_ops.decision_log CASCADE;

-- Drop functions in ai_ops schema (if any)
DROP FUNCTION IF EXISTS ai_ops.vector_search CASCADE;

-- Drop the entire ai_ops schema (cleanest approach - removes schema, tables, functions, and all dependencies)
-- This is the cleanest approach since we're rebuilding everything
DROP SCHEMA IF EXISTS ai_ops CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check remaining tables (should only show Auth tables):
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops', 'auth')
ORDER BY schemaname, tablename;

-- Check database size:
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- ============================================
-- STEP 3: RECLAIM SPACE (Important!)
-- ============================================
-- After deleting tables, PostgreSQL doesn't immediately free space.
-- You need to run VACUUM to reclaim it.
-- 
-- IMPORTANT: VACUUM cannot run inside a transaction block.
-- Run VACUUM in a SEPARATE query (not in this script).
-- 
-- WARNING: VACUUM FULL locks tables and can take time.
-- Run during low-traffic period.
--
-- After running this cleanup script, run this separately:
--   VACUUM FULL;
--
-- Then check size:
--   SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size_after_vacuum;

-- Note: Auth tables (in 'auth' schema) are managed by Supabase and should remain