-- ============================================
-- FIX AI TABLES PERMISSIONS (SIMPLE VERSION)
-- Grant full permissions to anon and authenticated roles
-- ============================================

-- Grant permissions on all AI tables
GRANT ALL ON TABLE public.ai_analysis_runs TO anon, authenticated;
GRANT ALL ON TABLE public.ai_company_analysis TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_sections TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_metrics TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_audit TO anon, authenticated;
GRANT ALL ON TABLE public.ai_screening_results TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_feedback TO anon, authenticated;

-- Grant permissions on all sequences (fixes the sequence permission errors)
GRANT ALL ON SEQUENCE public.ai_analysis_runs_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_company_analysis_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_sections_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_metrics_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_audit_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_screening_results_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_feedback_id_seq TO anon, authenticated;

-- Disable RLS on all AI tables for testing
ALTER TABLE public.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- Verification queries
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE 'ai_%' 
ORDER BY tablename;

SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name LIKE 'ai_%' 
    AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
