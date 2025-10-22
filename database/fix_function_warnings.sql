-- Fix Function Search Path Warnings (Optional)
-- These are warnings, not critical security issues
-- Run this only if you want to address the function search path warnings

-- ==============================================
-- 1. FIX FUNCTION SEARCH PATH WARNINGS
-- ==============================================

-- Fix update_updated_at_column function
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Fix is_admin function
ALTER FUNCTION public.is_admin() SET search_path = '';

-- Fix safe_to_numeric function
ALTER FUNCTION public.safe_to_numeric(text) SET search_path = '';

-- Fix safe_to_integer function
ALTER FUNCTION public.safe_to_integer(text) SET search_path = '';

-- Fix handle_new_user function
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- Fix make_user_admin function
ALTER FUNCTION public.make_user_admin(uuid) SET search_path = '';

-- ==============================================
-- 2. VERIFY CHANGES
-- ==============================================

-- Check that functions now have secure search_path
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    p.prosecdef as security_definer,
    p.proconfig as config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_updated_at_column',
        'is_admin',
        'safe_to_numeric',
        'safe_to_integer',
        'handle_new_user',
        'make_user_admin'
    )
ORDER BY p.proname;

-- ==============================================
-- 3. SUMMARY
-- ==============================================

SELECT 
    'Function Search Path Warnings Fixed' as status,
    'All functions now have secure search_path settings' as result,
    'These were warnings, not critical security issues' as note;
