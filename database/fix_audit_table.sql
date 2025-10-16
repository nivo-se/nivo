-- Fix audit table schema issues
-- This script ensures the ai_analysis_audit table exists with correct schema

-- Drop and recreate the audit table to ensure correct schema
DROP TABLE IF EXISTS public.ai_analysis_audit CASCADE;

CREATE TABLE public.ai_analysis_audit (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES public.ai_company_analysis(id) ON DELETE CASCADE,
    prompt_text TEXT,
    response_text TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd NUMERIC,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_analysis_audit_analysis_id ON public.ai_analysis_audit(analysis_id);
CREATE INDEX idx_ai_analysis_audit_created_at ON public.ai_analysis_audit(created_at);

-- Enable RLS
ALTER TABLE public.ai_analysis_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit table
CREATE POLICY "Users can view own audit logs" ON public.ai_analysis_audit 
FOR SELECT USING (
  analysis_id IN (
    SELECT id FROM public.ai_company_analysis 
    WHERE run_id IN (
      SELECT id FROM public.ai_analysis_runs 
      WHERE initiated_by = auth.uid() OR public.is_admin()
    )
  )
);

CREATE POLICY "Users can insert audit logs" ON public.ai_analysis_audit 
FOR INSERT WITH CHECK (
  analysis_id IN (
    SELECT id FROM public.ai_company_analysis 
    WHERE run_id IN (
      SELECT id FROM public.ai_analysis_runs 
      WHERE initiated_by = auth.uid()
    )
  )
);

-- Verify the table was created correctly
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_analysis_audit' 
  AND table_schema = 'public'
ORDER BY column_name;
