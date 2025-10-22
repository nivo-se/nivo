-- Fix Security Definer Views
-- This script addresses the SECURITY DEFINER view issues

-- ==============================================
-- 1. FIX SCRAPER MIGRATION STATS VIEW
-- ==============================================

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.scraper_migration_stats;

-- Recreate without SECURITY DEFINER
CREATE VIEW public.scraper_migration_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN migrated = true THEN 1 END) as migrated_records,
    COUNT(CASE WHEN migrated = false THEN 1 END) as pending_records,
    ROUND(
        (COUNT(CASE WHEN migrated = true THEN 1 END)::decimal / COUNT(*)) * 100, 
        2
    ) as migration_percentage
FROM public.scraper_data;

-- ==============================================
-- 2. FIX SCRAPER PENDING REVIEW VIEW
-- ==============================================

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.scraper_pending_review;

-- Recreate without SECURITY DEFINER
CREATE VIEW public.scraper_pending_review AS
SELECT *
FROM public.scraper_data
WHERE migrated = false
ORDER BY created_at DESC;

-- ==============================================
-- 3. VERIFY VIEWS
-- ==============================================

-- Check that views no longer have SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname IN ('scraper_migration_stats', 'scraper_pending_review');

-- Test the views to ensure they work
SELECT * FROM public.scraper_migration_stats LIMIT 1;
SELECT * FROM public.scraper_pending_review LIMIT 1;
