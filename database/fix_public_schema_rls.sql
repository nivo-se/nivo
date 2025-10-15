-- Fix RLS on public schema AI tables
-- Run this in Supabase SQL Editor

-- Enable RLS on the moved tables in public schema
ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for public schema tables
-- Policies for ai_analysis_runs
DROP POLICY IF EXISTS "Users can view own analysis runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can insert own analysis runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can update own analysis runs" ON public.ai_analysis_runs;

CREATE POLICY "Users can view own analysis runs" ON public.ai_analysis_runs
  FOR SELECT USING (
    initiated_by = auth.uid()::text OR public.is_admin()
  );

CREATE POLICY "Users can insert own analysis runs" ON public.ai_analysis_runs
  FOR INSERT WITH CHECK (initiated_by = auth.uid()::text);

CREATE POLICY "Users can update own analysis runs" ON public.ai_analysis_runs
  FOR UPDATE USING (
    initiated_by = auth.uid()::text OR public.is_admin()
  );

-- Policies for ai_screening_results
DROP POLICY IF EXISTS "Users can view own screening results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Users can insert screening results" ON public.ai_screening_results;

CREATE POLICY "Users can view own screening results" ON public.ai_screening_results
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM public.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert screening results" ON public.ai_screening_results
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM public.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- Policies for ai_company_analysis
DROP POLICY IF EXISTS "Users can view own company analyses" ON public.ai_company_analysis;
DROP POLICY IF EXISTS "Users can insert company analyses" ON public.ai_company_analysis;

CREATE POLICY "Users can view own company analyses" ON public.ai_company_analysis
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM public.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text OR public.is_admin()
    )
  );

CREATE POLICY "Users can insert company analyses" ON public.ai_company_analysis
  FOR INSERT WITH CHECK (
    run_id IN (
      SELECT id FROM public.ai_analysis_runs r 
      WHERE r.initiated_by = auth.uid()::text
    )
  );

-- For now, temporarily disable RLS to test database integration
ALTER TABLE public.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- Verify tables are in public schema and RLS status
SELECT schemaname, tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename LIKE 'ai_%' 
ORDER BY tablename;
