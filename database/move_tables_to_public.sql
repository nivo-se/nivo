-- Move AI tables from ai_ops schema to public schema for Supabase client access
-- Run this in Supabase SQL Editor

-- Move ai_analysis_runs table
ALTER TABLE ai_ops.ai_analysis_runs SET SCHEMA public;

-- Move ai_screening_results table  
ALTER TABLE ai_ops.ai_screening_results SET SCHEMA public;

-- Move ai_company_analysis table
ALTER TABLE ai_ops.ai_company_analysis SET SCHEMA public;

-- Move ai_analysis_sections table
ALTER TABLE ai_ops.ai_analysis_sections SET SCHEMA public;

-- Move ai_analysis_metrics table
ALTER TABLE ai_ops.ai_analysis_metrics SET SCHEMA public;

-- Move ai_analysis_audit table
ALTER TABLE ai_ops.ai_analysis_audit SET SCHEMA public;

-- Move ai_analysis_feedback table
ALTER TABLE ai_ops.ai_analysis_feedback SET SCHEMA public;

-- Update the views to reference public schema
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

-- Verify tables are in public schema
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE 'ai_%' 
ORDER BY tablename;
