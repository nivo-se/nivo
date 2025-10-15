-- Temporary disable RLS for testing database integration
-- Run this in Supabase SQL Editor to allow server-side operations

-- Disable RLS on ai_ops tables temporarily
ALTER TABLE ai_ops.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ops.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'ai_ops' 
ORDER BY tablename;
