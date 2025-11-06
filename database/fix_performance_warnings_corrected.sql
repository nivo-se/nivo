-- Fix Supabase Performance Security Lints (CORRECTED)
-- Addresses RLS performance issues and duplicate indexes with proper column references

-- ==============================================
-- 1. Fix Auth RLS Initialization Plan Issues
-- ==============================================

-- Fix user_roles RLS policy performance
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Fix valuation_runs RLS policy performance  
DROP POLICY IF EXISTS "Users can access their own valuation runs" ON public.valuation_runs;
CREATE POLICY "Users can access their own valuation runs" ON public.valuation_runs
  FOR ALL USING (
    analysis_run_id IN (
      SELECT id FROM public.ai_analysis_runs 
      WHERE initiated_by = (select auth.uid())::text
    )
  );

-- Fix valuation_results RLS policy performance
DROP POLICY IF EXISTS "Users can access their own valuation results" ON public.valuation_results;
CREATE POLICY "Users can access their own valuation results" ON public.valuation_results
  FOR ALL USING (
    valuation_run_id IN (
      SELECT vr.id FROM public.valuation_runs vr
      JOIN public.ai_analysis_runs ar ON vr.analysis_run_id = ar.id
      WHERE ar.initiated_by = (select auth.uid())::text
    )
  );

-- ==============================================
-- 2. Fix Multiple Permissive Policies Issues
-- ==============================================

-- Clean up scraper_staging_companies policies
-- Drop all existing policies first
DROP POLICY IF EXISTS "Only admins can modify scraper companies" ON public.scraper_staging_companies;
DROP POLICY IF EXISTS "Only admins can view scraper companies" ON public.scraper_staging_companies;
DROP POLICY IF EXISTS "Service role can do everything on scraper_staging_companies" ON public.scraper_staging_companies;

-- Create single consolidated policies
CREATE POLICY "Scraper staging companies access" ON public.scraper_staging_companies
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Clean up scraper_staging_company_ids policies
DROP POLICY IF EXISTS "Only admins can modify scraper company ids" ON public.scraper_staging_company_ids;
DROP POLICY IF EXISTS "Only admins can view scraper company ids" ON public.scraper_staging_company_ids;
DROP POLICY IF EXISTS "Service role can do everything on scraper_staging_company_ids" ON public.scraper_staging_company_ids;

CREATE POLICY "Scraper staging company ids access" ON public.scraper_staging_company_ids
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Clean up scraper_staging_jobs policies
DROP POLICY IF EXISTS "Only admins can modify scraper jobs" ON public.scraper_staging_jobs;
DROP POLICY IF EXISTS "Only admins can view scraper jobs" ON public.scraper_staging_jobs;
DROP POLICY IF EXISTS "Service role can do everything on scraper_staging_jobs" ON public.scraper_staging_jobs;

CREATE POLICY "Scraper staging jobs access" ON public.scraper_staging_jobs
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Clean up user_roles policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Create consolidated user_roles policies
CREATE POLICY "User roles management" ON public.user_roles
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id OR
    (select auth.uid()) IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Clean up valuation_assumptions policies
DROP POLICY IF EXISTS "Admins can manage valuation assumptions" ON public.valuation_assumptions;
DROP POLICY IF EXISTS "Users can read valuation assumptions" ON public.valuation_assumptions;

CREATE POLICY "Valuation assumptions access" ON public.valuation_assumptions
  FOR SELECT USING (true);

CREATE POLICY "Valuation assumptions management" ON public.valuation_assumptions
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- ==============================================
-- 3. Fix Duplicate Index Issue
-- ==============================================

-- Drop duplicate index on user_roles
DROP INDEX IF EXISTS public.idx_user_roles_role;
-- Keep user_roles_role_idx as it's likely the more standard naming

-- ==============================================
-- 4. Verify Fixes
-- ==============================================

-- Check remaining policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Check remaining indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'user_roles'
ORDER BY indexname;
