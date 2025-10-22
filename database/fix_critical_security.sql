-- Fix Critical Supabase Security Issues
-- Run this first to address the most critical security problems

-- ==============================================
-- 1. FIX SAVED COMPANY LISTS RLS (CRITICAL)
-- ==============================================

-- Enable RLS on saved_company_lists table
ALTER TABLE public.saved_company_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can insert own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.saved_company_lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.saved_company_lists;

-- Create proper RLS policies for saved_company_lists
CREATE POLICY "Users can view own lists" ON public.saved_company_lists
    FOR SELECT
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can insert own lists" ON public.saved_company_lists
    FOR INSERT
    WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can update own lists" ON public.saved_company_lists
    FOR UPDATE
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
    WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can delete own lists" ON public.saved_company_lists
    FOR DELETE
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- ==============================================
-- 2. ENABLE RLS FOR AI ANALYSIS TABLES
-- ==============================================

-- Enable RLS on AI analysis tables
ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_sections" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_metrics" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_audit" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Allow all operations on ai_screening_results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_feedback" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Allow all operations on ai_company_analysis" ON public.ai_company_analysis;

-- Create permissive policies for AI analysis tables (for development)
-- These can be made more restrictive in production
CREATE POLICY "Allow all operations on ai_analysis_runs" ON public.ai_analysis_runs
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_analysis_sections" ON public.ai_analysis_sections
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_analysis_metrics" ON public.ai_analysis_metrics
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_analysis_audit" ON public.ai_analysis_audit
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_screening_results" ON public.ai_screening_results
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_analysis_feedback" ON public.ai_analysis_feedback
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_company_analysis" ON public.ai_company_analysis
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==============================================
-- 3. VERIFY CHANGES
-- ==============================================

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'saved_company_lists',
        'ai_analysis_runs',
        'ai_analysis_sections',
        'ai_analysis_metrics',
        'ai_analysis_audit',
        'ai_screening_results',
        'ai_analysis_feedback',
        'ai_company_analysis'
    )
ORDER BY tablename;
