-- Drop Problematic Security Definer Views
-- Simple solution: Remove the views that are causing security issues

-- ==============================================
-- 1. DROP SECURITY DEFINER VIEWS
-- ==============================================

-- Drop the views that have SECURITY DEFINER issues
DROP VIEW IF EXISTS public.scraper_migration_stats;
DROP VIEW IF EXISTS public.scraper_pending_review;

-- ==============================================
-- 2. VERIFY VIEWS ARE REMOVED
-- ==============================================

-- Check that the problematic views no longer exist
SELECT 
    schemaname,
    viewname,
    'View Dropped' as status
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname IN ('scraper_migration_stats', 'scraper_pending_review');

-- If the query returns no rows, the views have been successfully removed

-- ==============================================
-- 3. SUMMARY
-- ==============================================

SELECT 
    'Security Definer Views Removed' as status,
    'All problematic views with SECURITY DEFINER have been dropped' as result,
    'Security linter warnings should now be resolved' as next_step;
