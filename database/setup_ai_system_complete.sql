-- ============================================
-- COMPLETE AI SYSTEM SETUP
-- This script will create everything needed for the AI analysis system
-- ============================================

-- First, let's see what currently exists
SELECT '=== CURRENT AI TABLES ===' as status;
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE 'ai_%' 
ORDER BY tablename;

SELECT '=== CURRENT AI SEQUENCES ===' as status;
SELECT 
    schemaname,
    sequencename
FROM pg_sequences 
WHERE schemaname = 'public' 
    AND sequencename LIKE 'ai_%'
ORDER BY sequencename;

-- ============================================
-- CREATE ALL AI TABLES
-- ============================================

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS public.ai_analysis_feedback CASCADE;
DROP TABLE IF EXISTS public.ai_screening_results CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_audit CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_metrics CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_sections CASCADE;
DROP TABLE IF EXISTS public.ai_company_analysis CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_runs CASCADE;

-- Create ai_analysis_runs table
CREATE TABLE public.ai_analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiated_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    model_version TEXT,
    analysis_mode TEXT,
    filters_json JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_company_analysis table
CREATE TABLE public.ai_company_analysis (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    company_name TEXT NOT NULL,
    summary TEXT,
    recommendation TEXT,
    confidence INTEGER,
    risk_score INTEGER,
    financial_grade TEXT,
    commercial_grade TEXT,
    operational_grade TEXT,
    next_steps TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_sections table
CREATE TABLE public.ai_analysis_sections (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT,
    confidence INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_metrics table
CREATE TABLE public.ai_analysis_metrics (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value TEXT,
    metric_unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_audit table
CREATE TABLE public.ai_analysis_audit (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_screening_results table
CREATE TABLE public.ai_screening_results (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    company_name TEXT NOT NULL,
    screening_score INTEGER,
    risk_flag TEXT,
    brief_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_feedback table
CREATE TABLE public.ai_analysis_feedback (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    user_id UUID,
    feedback_type TEXT,
    feedback_text TEXT,
    rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_initiated_by ON public.ai_analysis_runs(initiated_by);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_status ON public.ai_analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_created_at ON public.ai_analysis_runs(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_company_analysis_run_id ON public.ai_company_analysis(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_company_analysis_orgnr ON public.ai_company_analysis(orgnr);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_sections_run_id ON public.ai_analysis_sections(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_sections_type ON public.ai_analysis_sections(section_type);

CREATE INDEX IF NOT EXISTS idx_ai_screening_results_run_id ON public.ai_screening_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_screening_results_orgnr ON public.ai_screening_results(orgnr);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant permissions on all tables
GRANT ALL ON TABLE public.ai_analysis_runs TO anon, authenticated;
GRANT ALL ON TABLE public.ai_company_analysis TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_sections TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_metrics TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_audit TO anon, authenticated;
GRANT ALL ON TABLE public.ai_screening_results TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_feedback TO anon, authenticated;

-- Grant permissions on all sequences
GRANT ALL ON SEQUENCE public.ai_company_analysis_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_sections_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_metrics_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_audit_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_screening_results_id_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.ai_analysis_feedback_id_seq TO anon, authenticated;

-- ============================================
-- DISABLE RLS FOR TESTING
-- ============================================

ALTER TABLE public.ai_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback DISABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE HELPFUL VIEWS
-- ============================================

-- View for latest analysis per company
CREATE OR REPLACE VIEW public.ai_company_analysis_latest AS
SELECT DISTINCT ON (orgnr)
    orgnr,
    company_name,
    summary,
    recommendation,
    confidence,
    risk_score,
    financial_grade,
    commercial_grade,
    operational_grade,
    next_steps,
    run_id,
    ai_company_analysis.created_at
FROM public.ai_company_analysis
JOIN public.ai_analysis_runs ON ai_analysis_runs.id = ai_company_analysis.run_id
WHERE ai_analysis_runs.status = 'completed'
ORDER BY orgnr, ai_company_analysis.created_at DESC;

-- View for dashboard feed
CREATE OR REPLACE VIEW public.ai_analysis_dashboard_feed AS
SELECT
    ca.run_id,
    ca.orgnr,
    ca.company_name,
    ca.summary,
    ca.recommendation,
    ca.confidence,
    ca.risk_score,
    ca.financial_grade,
    ca.commercial_grade,
    ca.operational_grade,
    ca.next_steps,
    r.model_version,
    r.started_at,
    r.completed_at
FROM public.ai_company_analysis ca
JOIN public.ai_analysis_runs r ON r.id = ca.run_id;

-- Grant permissions on views
GRANT ALL ON VIEW public.ai_company_analysis_latest TO anon, authenticated;
GRANT ALL ON VIEW public.ai_analysis_dashboard_feed TO anon, authenticated;

-- ============================================
-- FINAL VERIFICATION
-- ============================================

SELECT '=== FINAL AI TABLES ===' as status;
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE 'ai_%' 
ORDER BY tablename;

SELECT '=== FINAL AI SEQUENCES ===' as status;
SELECT 
    schemaname,
    sequencename
FROM pg_sequences 
WHERE schemaname = 'public' 
    AND sequencename LIKE 'ai_%'
ORDER BY sequencename;

SELECT '=== FINAL AI VIEWS ===' as status;
SELECT 
    schemaname,
    viewname
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname LIKE 'ai_%'
ORDER BY viewname;

SELECT '=== PERMISSIONS CHECK ===' as status;
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name LIKE 'ai_%' 
    AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

SELECT '=== SETUP COMPLETE ===' as status;
