-- Complete RLS cleanup - remove all policies and disable RLS
-- Run this in Supabase SQL Editor

-- Drop ALL policies on AI tables
DROP POLICY IF EXISTS "Users can view own analysis runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can insert own analysis runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can update own analysis runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Users can delete own analysis runs" ON public.ai_analysis_runs;

DROP POLICY IF EXISTS "Users can view own screening results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Users can insert screening results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Users can update screening results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Users can delete screening results" ON public.ai_screening_results;

DROP POLICY IF EXISTS "Users can view own company analyses" ON public.ai_company_analysis;
DROP POLICY IF EXISTS "Users can insert company analyses" ON public.ai_company_analysis;
DROP POLICY IF EXISTS "Users can update company analyses" ON public.ai_company_analysis;
DROP POLICY IF EXISTS "Users can delete company analyses" ON public.ai_company_analysis;

DROP POLICY IF EXISTS "Users can view own analysis sections" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Users can insert analysis sections" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Users can update analysis sections" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Users can delete analysis sections" ON public.ai_analysis_sections;

DROP POLICY IF EXISTS "Users can view own analysis metrics" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Users can insert analysis metrics" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Users can update analysis metrics" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Users can delete analysis metrics" ON public.ai_analysis_metrics;

DROP POLICY IF EXISTS "Users can view own analysis audit logs" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Users can update audit logs" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Users can delete audit logs" ON public.ai_analysis_audit;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.ai_analysis_feedback;

-- Disable RLS on all AI tables
ALTER TABLE public.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- Grant full access to anon role for testing
GRANT ALL ON public.ai_analysis_runs TO anon;
GRANT ALL ON public.ai_screening_results TO anon;
GRANT ALL ON public.ai_company_analysis TO anon;
GRANT ALL ON public.ai_analysis_sections TO anon;
GRANT ALL ON public.ai_analysis_metrics TO anon;
GRANT ALL ON public.ai_analysis_audit TO anon;
GRANT ALL ON public.ai_analysis_feedback TO anon;

-- Grant full access to authenticated role for testing
GRANT ALL ON public.ai_analysis_runs TO authenticated;
GRANT ALL ON public.ai_screening_results TO authenticated;
GRANT ALL ON public.ai_company_analysis TO authenticated;
GRANT ALL ON public.ai_analysis_sections TO authenticated;
GRANT ALL ON public.ai_analysis_metrics TO authenticated;
GRANT ALL ON public.ai_analysis_audit TO authenticated;
GRANT ALL ON public.ai_analysis_feedback TO authenticated;

-- Verify RLS is disabled and permissions are granted
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    has_table_privilege('anon', schemaname||'.'||tablename, 'INSERT') as anon_can_insert,
    has_table_privilege('authenticated', schemaname||'.'||tablename, 'INSERT') as auth_can_insert
FROM pg_tables 
WHERE tablename LIKE 'ai_%' 
ORDER BY tablename;
