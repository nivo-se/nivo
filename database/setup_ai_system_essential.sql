-- ============================================
-- ESSENTIAL AI SYSTEM SETUP (NO VIEWS)
-- This script creates the core AI tables and permissions
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
-- DROP EXISTING TABLES (CLEAN SLATE)
-- ============================================

DROP TABLE IF EXISTS public.ai_analysis_feedback CASCADE;
DROP TABLE IF EXISTS public.ai_screening_results CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_audit CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_metrics CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_sections CASCADE;
DROP TABLE IF EXISTS public.ai_company_analysis CASCADE;
DROP TABLE IF EXISTS public.ai_analysis_runs CASCADE;

-- ============================================
-- CREATE ALL AI TABLES
-- ============================================

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
-- GRANT PERMISSIONS ON TABLES
-- ============================================

GRANT ALL ON TABLE public.ai_analysis_runs TO anon, authenticated;
GRANT ALL ON TABLE public.ai_company_analysis TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_sections TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_metrics TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_audit TO anon, authenticated;
GRANT ALL ON TABLE public.ai_screening_results TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_feedback TO anon, authenticated;

-- ============================================
-- GRANT PERMISSIONS ON SEQUENCES
-- ============================================

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
