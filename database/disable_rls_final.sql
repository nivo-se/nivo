-- Completely disable RLS on all AI tables for testing
-- Run this in Supabase SQL Editor

-- Disable RLS on all AI tables in public schema
ALTER TABLE public.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename LIKE 'ai_%' 
ORDER BY tablename;
