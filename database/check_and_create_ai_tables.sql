-- ============================================
-- CHECK AND CREATE AI TABLES AND SEQUENCES
-- ============================================

-- First, let's see what AI tables actually exist
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE 'ai_%' 
ORDER BY tablename;

-- Check what sequences exist
SELECT 
    schemaname,
    sequencename
FROM pg_sequences 
WHERE schemaname = 'public' 
    AND sequencename LIKE 'ai_%'
ORDER BY sequencename;

-- If the tables don't exist, we need to create them
-- Let's create the basic AI tables structure

-- Create ai_analysis_runs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_analysis_runs (
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

-- Create ai_company_analysis table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_company_analysis (
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

-- Create ai_analysis_sections table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_analysis_sections (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT,
    confidence INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_metrics table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_analysis_metrics (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value TEXT,
    metric_unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_analysis_audit (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_screening_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_screening_results (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    company_name TEXT NOT NULL,
    screening_score INTEGER,
    risk_flag TEXT,
    brief_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analysis_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_analysis_feedback (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    user_id UUID,
    feedback_type TEXT,
    feedback_text TEXT,
    rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now grant permissions on all tables and sequences
GRANT ALL ON TABLE public.ai_analysis_runs TO anon, authenticated;
GRANT ALL ON TABLE public.ai_company_analysis TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_sections TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_metrics TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_audit TO anon, authenticated;
GRANT ALL ON TABLE public.ai_screening_results TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_feedback TO anon, authenticated;

-- Grant permissions on sequences (they should exist now)
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

-- Final verification
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE 'ai_%' 
ORDER BY tablename;

SELECT 
    schemaname,
    sequencename
FROM pg_sequences 
WHERE schemaname = 'public' 
    AND sequencename LIKE 'ai_%'
ORDER BY sequencename;
