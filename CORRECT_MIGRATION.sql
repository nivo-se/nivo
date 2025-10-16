-- CORRECT MIGRATION FOR PUBLIC SCHEMA
-- The ai_analysis_runs table exists in the public schema, not ai_ops schema

-- Add new columns to track analysis focus and template information
ALTER TABLE public.ai_analysis_runs 
ADD COLUMN IF NOT EXISTS analysis_template_id text,
ADD COLUMN IF NOT EXISTS analysis_template_name text,
ADD COLUMN IF NOT EXISTS custom_instructions text,
ADD COLUMN IF NOT EXISTS company_count integer DEFAULT 0;

-- Create indexes for efficient querying by template and date
CREATE INDEX IF NOT EXISTS ai_analysis_runs_template_idx 
ON public.ai_analysis_runs(analysis_template_id, started_at DESC);

-- Create index for efficient querying by company count
CREATE INDEX IF NOT EXISTS ai_analysis_runs_company_count_idx 
ON public.ai_analysis_runs(company_count DESC, started_at DESC);

-- Create index for efficient querying by analysis mode and status
CREATE INDEX IF NOT EXISTS ai_analysis_runs_mode_status_idx 
ON public.ai_analysis_runs(analysis_mode, status, started_at DESC);

-- Add comments to document the new columns
COMMENT ON COLUMN public.ai_analysis_runs.analysis_template_id IS 'ID of the analysis template used (if any)';
COMMENT ON COLUMN public.ai_analysis_runs.analysis_template_name IS 'Name of the analysis template used (if any)';
COMMENT ON COLUMN public.ai_analysis_runs.custom_instructions IS 'Custom instructions provided by user (if no template used)';
COMMENT ON COLUMN public.ai_analysis_runs.company_count IS 'Number of companies analyzed in this run';
