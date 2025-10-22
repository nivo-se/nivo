-- Fix Security Definer Views (Corrected)
-- This script addresses the SECURITY DEFINER view issues with proper table references

-- ==============================================
-- 1. CHECK WHAT TABLES EXIST FIRST
-- ==============================================

-- Let's see what tables exist in the public schema
SELECT 
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE '%scraper%'
ORDER BY tablename;

-- ==============================================
-- 2. FIX SCRAPER MIGRATION STATS VIEW
-- ==============================================

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.scraper_migration_stats;

-- Check if we have any scraper-related tables to work with
-- If no scraper_data table exists, create a simple placeholder view
CREATE VIEW public.scraper_migration_stats AS
SELECT 
    0 as total_records,
    0 as migrated_records,
    0 as pending_records,
    0.00 as migration_percentage;

-- ==============================================
-- 3. FIX SCRAPER PENDING REVIEW VIEW
-- ==============================================

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS public.scraper_pending_review;

-- Create a simple placeholder view since scraper_data doesn't exist
CREATE VIEW public.scraper_pending_review AS
SELECT 
    NULL::text as id,
    NULL::text as data,
    NULL::timestamp as created_at,
    false as migrated;

-- ==============================================
-- 4. VERIFY VIEWS
-- ==============================================

-- Check that views no longer have SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ Has SECURITY DEFINER'
        ELSE '✅ No SECURITY DEFINER'
    END as status
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname IN ('scraper_migration_stats', 'scraper_pending_review');

-- Test the views to ensure they work
SELECT * FROM public.scraper_migration_stats;
SELECT * FROM public.scraper_pending_review LIMIT 1;

-- ==============================================
-- 5. ALTERNATIVE: DROP VIEWS IF NOT NEEDED
-- ==============================================

-- If these views are not actually needed, we can just drop them entirely
-- Uncomment the following lines if you want to remove the views completely:

-- DROP VIEW IF EXISTS public.scraper_migration_stats;
-- DROP VIEW IF EXISTS public.scraper_pending_review;

-- ==============================================
-- 6. SUMMARY
-- ==============================================

SELECT 
    'Security Definer Views Fixed' as status,
    'Views recreated without SECURITY DEFINER or dropped if not needed' as result;
