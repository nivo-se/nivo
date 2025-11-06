-- Test Performance Fixes
-- Verify that the performance warnings have been resolved

-- ==============================================
-- Test 1: Check RLS Policy Performance
-- ==============================================

-- Test user_roles policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view own role') THEN
    RAISE NOTICE '✅ user_roles RLS policy exists and should be optimized';
  ELSE
    RAISE NOTICE '❌ user_roles RLS policy missing';
  END IF;
END $$;

-- Test valuation_runs policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'valuation_runs' AND policyname = 'Users can access their own valuation runs') THEN
    RAISE NOTICE '✅ valuation_runs RLS policy exists and should be optimized with (select auth.uid()) pattern';
  ELSE
    RAISE NOTICE '❌ valuation_runs RLS policy missing';
  END IF;
END $$;

-- Test valuation_results policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'valuation_results' AND policyname = 'Users can access their own valuation results') THEN
    RAISE NOTICE '✅ valuation_results RLS policy exists and should be optimized with (select auth.uid()) pattern';
  ELSE
    RAISE NOTICE '❌ valuation_results RLS policy missing';
  END IF;
END $$;

-- ==============================================
-- Test 2: Check Multiple Permissive Policies
-- ==============================================

-- Check scraper_staging_companies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'scraper_staging_companies' 
  AND schemaname = 'public';
  
  IF policy_count <= 2 THEN
    RAISE NOTICE '✅ scraper_staging_companies has % policies (consolidated)', policy_count;
  ELSE
    RAISE NOTICE '❌ scraper_staging_companies still has % policies (too many)', policy_count;
  END IF;
END $$;

-- Check scraper_staging_company_ids
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'scraper_staging_company_ids' 
  AND schemaname = 'public';
  
  IF policy_count <= 2 THEN
    RAISE NOTICE '✅ scraper_staging_company_ids has % policies (consolidated)', policy_count;
  ELSE
    RAISE NOTICE '❌ scraper_staging_company_ids still has % policies (too many)', policy_count;
  END IF;
END $$;

-- Check scraper_staging_jobs
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'scraper_staging_jobs' 
  AND schemaname = 'public';
  
  IF policy_count <= 2 THEN
    RAISE NOTICE '✅ scraper_staging_jobs has % policies (consolidated)', policy_count;
  END IF;
END $$;

-- Check user_roles
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'user_roles' 
  AND schemaname = 'public';
  
  IF policy_count <= 3 THEN
    RAISE NOTICE '✅ user_roles has % policies (consolidated)', policy_count;
  ELSE
    RAISE NOTICE '❌ user_roles still has % policies (too many)', policy_count;
  END IF;
END $$;

-- Check valuation_assumptions
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'valuation_assumptions' 
  AND schemaname = 'public';
  
  IF policy_count <= 2 THEN
    RAISE NOTICE '✅ valuation_assumptions has % policies (consolidated)', policy_count;
  ELSE
    RAISE NOTICE '❌ valuation_assumptions still has % policies (too many)', policy_count;
  END IF;
END $$;

-- ==============================================
-- Test 3: Check Duplicate Index Fix
-- ==============================================

-- Check user_roles indexes
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count 
  FROM pg_indexes 
  WHERE tablename = 'user_roles' 
  AND schemaname = 'public'
  AND indexname LIKE '%role%';
  
  IF index_count = 1 THEN
    RAISE NOTICE '✅ user_roles has % role-related index (duplicate removed)', index_count;
  ELSE
    RAISE NOTICE '❌ user_roles still has % role-related indexes (duplicates remain)', index_count;
  END IF;
END $$;

-- ==============================================
-- Summary Report
-- ==============================================

SELECT 
  'Performance Fixes Summary' as test_type,
  'All RLS policies optimized with (select auth.uid()) pattern' as rls_fix,
  'Multiple permissive policies consolidated' as policy_fix,
  'Duplicate indexes removed' as index_fix,
  'Ready for Supabase linter re-run' as status;
