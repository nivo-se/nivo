-- Fix Policy Conflicts
-- This script handles existing policies that are causing conflicts

-- ==============================================
-- 1. DROP ALL EXISTING AI ANALYSIS POLICIES
-- ==============================================

-- Drop existing policies on AI analysis tables
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_runs" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_sections" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_metrics" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_audit" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Allow all operations on ai_screening_results" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Allow all operations on ai_analysis_feedback" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Allow all operations on ai_company_analysis" ON public.ai_company_analysis;

-- Drop any other existing policies on these tables
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_analysis_runs;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_analysis_sections;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_analysis_metrics;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_analysis_audit;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_screening_results;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_analysis_feedback;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.ai_company_analysis;

-- ==============================================
-- 2. ENABLE RLS ON AI ANALYSIS TABLES
-- ==============================================

-- Enable RLS on AI analysis tables
ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_company_analysis ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. CREATE NEW POLICIES
-- ==============================================

-- Create permissive policies for AI analysis tables
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
-- 4. VERIFY POLICIES
-- ==============================================

-- Check that policies were created successfully
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN (
        'ai_analysis_runs',
        'ai_analysis_sections',
        'ai_analysis_metrics',
        'ai_analysis_audit',
        'ai_screening_results',
        'ai_analysis_feedback',
        'ai_company_analysis'
    )
ORDER BY tablename, policyname;

-- ==============================================
-- 5. SUMMARY
-- ==============================================

SELECT 
    'Policy Conflicts Fixed' as status,
    'All AI analysis table policies recreated successfully' as result;
