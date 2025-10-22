-- Check Database Structure
-- This script helps identify what tables and views exist in your database

-- ==============================================
-- 1. CHECK ALL TABLES IN PUBLIC SCHEMA
-- ==============================================

SELECT 
    tablename,
    tableowner,
    CASE 
        WHEN rowsecurity = true THEN 'RLS Enabled'
        ELSE 'RLS Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- ==============================================
-- 2. CHECK ALL VIEWS IN PUBLIC SCHEMA
-- ==============================================

SELECT 
    viewname,
    viewowner,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN 'Has SECURITY DEFINER'
        ELSE 'No SECURITY DEFINER'
    END as security_status
FROM pg_views 
WHERE schemaname = 'public' 
ORDER BY viewname;

-- ==============================================
-- 3. CHECK RLS POLICIES
-- ==============================================

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    permissive
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==============================================
-- 4. SUMMARY
-- ==============================================

SELECT 
    COUNT(*) as total_tables,
    COUNT(CASE WHEN rowsecurity = true THEN 1 END) as tables_with_rls,
    COUNT(CASE WHEN rowsecurity = false THEN 1 END) as tables_without_rls
FROM pg_tables 
WHERE schemaname = 'public';

SELECT 
    COUNT(*) as total_views,
    COUNT(CASE WHEN definition LIKE '%SECURITY DEFINER%' THEN 1 END) as views_with_security_definer
FROM pg_views 
WHERE schemaname = 'public';
