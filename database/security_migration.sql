-- ============================================
-- SECURITY & PERMISSIONS MIGRATION (FULLY FIXED)
-- Run this BEFORE implementing AI features
-- ============================================

-- ====================================
-- PART 1: AI_OPS SCHEMA RLS POLICIES
-- ====================================

-- Enable RLS on all ai_ops tables
ALTER TABLE ai_ops.ai_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_company_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_feedback ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() -- user_roles.user_id is expected to be uuid
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for ai_analysis_runs
DROP POLICY IF EXISTS "Users can view own analysis runs" ON ai_ops.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can insert own analysis runs" ON ai_ops.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can update own analysis runs" ON ai_ops.ai_analysis_runs;

CREATE POLICY "Users can view own analysis runs" ON ai_ops.ai_analysis_runs
  FOR SELECT USING (
    initiated_by = auth.uid()::text OR public.is_admin()
  );

CREATE POLICY "Users can insert own analysis runs" ON ai_ops.ai_analysis_runs
  FOR INSERT WITH CHECK (initiated_by = auth.uid()::text);

CREATE POLICY "Users can update own analysis runs" ON ai_ops.ai_analysis_runs
  FOR UPDATE USING (
    initiated_by = auth.uid()::text OR public.is_admin()
  );

-- Policies for ai_company_analysis
DROP POLICY IF EXISTS "Users can view own company analyses" ON ai_ops.ai_company_analysis;
DROP POLICY IF EXISTS "Users can insert company analyses" ON ai_ops.ai_company_analysis;

CREATE POLICY "Users can view own company analyses" ON ai_ops.ai_company_analysis
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert company analyses" ON ai_ops.ai_company_analysis
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_screening_results
DROP POLICY IF EXISTS "Users can view own screening results" ON ai_ops.ai_screening_results;
DROP POLICY IF EXISTS "Users can insert screening results" ON ai_ops.ai_screening_results;

CREATE POLICY "Users can view own screening results" ON ai_ops.ai_screening_results
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert screening results" ON ai_ops.ai_screening_results
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_analysis_sections
DROP POLICY IF EXISTS "Users can view own analysis sections" ON ai_ops.ai_analysis_sections;
DROP POLICY IF EXISTS "Users can insert analysis sections" ON ai_ops.ai_analysis_sections;

CREATE POLICY "Users can view own analysis sections" ON ai_ops.ai_analysis_sections
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert analysis sections" ON ai_ops.ai_analysis_sections
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_analysis_metrics
DROP POLICY IF EXISTS "Users can view own analysis metrics" ON ai_ops.ai_analysis_metrics;
DROP POLICY IF EXISTS "Users can insert analysis metrics" ON ai_ops.ai_analysis_metrics;

CREATE POLICY "Users can view own analysis metrics" ON ai_ops.ai_analysis_metrics
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert analysis metrics" ON ai_ops.ai_analysis_metrics
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_analysis_audit
DROP POLICY IF EXISTS "Users can view own analysis audit logs" ON ai_ops.ai_analysis_audit;
DROP POLICY IF EXISTS "Users can insert audit logs" ON ai_ops.ai_analysis_audit;

CREATE POLICY "Users can view own analysis audit logs" ON ai_ops.ai_analysis_audit
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert audit logs" ON ai_ops.ai_analysis_audit
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM ai_ops.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_analysis_feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON ai_ops.ai_analysis_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON ai_ops.ai_analysis_feedback;

CREATE POLICY "Users can view own feedback" ON ai_ops.ai_analysis_feedback
  FOR SELECT USING (
    user_id = auth.uid()::text OR public.is_admin()
  );

CREATE POLICY "Users can insert own feedback" ON ai_ops.ai_analysis_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- ====================================
-- PART 2: SECURE UNRESTRICTED TABLES
-- ====================================

-- Enable RLS on scraper tables
ALTER TABLE public.scraper_staging_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_staging_company_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_staging_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only admins can view scraper companies" ON public.scraper_staging_companies;
DROP POLICY IF EXISTS "Only admins can modify scraper companies" ON public.scraper_staging_companies;
DROP POLICY IF EXISTS "Only admins can view scraper company ids" ON public.scraper_staging_company_ids;
DROP POLICY IF EXISTS "Only admins can modify scraper company ids" ON public.scraper_staging_company_ids;
DROP POLICY IF EXISTS "Only admins can view scraper jobs" ON public.scraper_staging_jobs;
DROP POLICY IF EXISTS "Only admins can modify scraper jobs" ON public.scraper_staging_jobs;

-- Only admins can access scraper tables
CREATE POLICY "Only admins can view scraper companies" ON public.scraper_staging_companies
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Only admins can modify scraper companies" ON public.scraper_staging_companies
  FOR ALL USING (public.is_admin());

CREATE POLICY "Only admins can view scraper company ids" ON public.scraper_staging_company_ids
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Only admins can modify scraper company ids" ON public.scraper_staging_company_ids
  FOR ALL USING (public.is_admin());

CREATE POLICY "Only admins can view scraper jobs" ON public.scraper_staging_jobs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Only admins can modify scraper jobs" ON public.scraper_staging_jobs
  FOR ALL USING (public.is_admin());

-- Restrict backup table (read-only for admins)
ALTER TABLE public.master_analytics_backup_20251007 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view backup" ON public.master_analytics_backup_20251007;
CREATE POLICY "Only admins can view backup" ON public.master_analytics_backup_20251007
  FOR SELECT USING (public.is_admin());

-- ====================================
-- PART 3: VERIFY USER_ROLES TABLE
-- ====================================

-- Enable RLS on user_roles if not already enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Recreate policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin());

-- ====================================
-- PART 4: VERIFY SAVED_COMPANY_LISTS
-- ====================================

-- Verify RLS is enabled
ALTER TABLE public.saved_company_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can insert own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.saved_company_lists;

-- Recreate policies (user_id expected as uuid)
CREATE POLICY "Users can view own lists" ON public.saved_company_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lists" ON public.saved_company_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists" ON public.saved_company_lists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists" ON public.saved_company_lists
  FOR DELETE USING (auth.uid() = user_id);

-- ====================================
-- VERIFICATION QUERIES
-- ====================================

-- Check RLS is enabled on all critical tables
SELECT schemaname, tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname IN ('ai_ops', 'public') 
  AND tablename IN (
    'ai_analysis_runs', 'ai_company_analysis', 'ai_screening_results',
    'saved_company_lists', 'user_roles', 'scraper_staging_companies',
    'master_analytics_backup_20251007'
  )
ORDER BY schemaname, tablename;

-- Count policies per table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname IN ('ai_ops', 'public')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- List all policies for ai_ops schema
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'ai_ops'
ORDER BY tablename, policyname;
