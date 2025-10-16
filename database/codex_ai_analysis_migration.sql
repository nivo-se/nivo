-- ============================================
-- CODEX AI ANALYSIS ENHANCEMENT MIGRATION
-- Add new fields to support sophisticated AI analysis
-- ============================================

-- Add new columns to ai_company_analysis table
ALTER TABLE public.ai_company_analysis 
ADD COLUMN IF NOT EXISTS executive_summary TEXT,
ADD COLUMN IF NOT EXISTS key_findings JSONB,
ADD COLUMN IF NOT EXISTS narrative TEXT,
ADD COLUMN IF NOT EXISTS strengths JSONB,
ADD COLUMN IF NOT EXISTS weaknesses JSONB,
ADD COLUMN IF NOT EXISTS opportunities JSONB,
ADD COLUMN IF NOT EXISTS risks JSONB,
ADD COLUMN IF NOT EXISTS acquisition_interest TEXT,
ADD COLUMN IF NOT EXISTS financial_health_score NUMERIC,
ADD COLUMN IF NOT EXISTS growth_outlook TEXT,
ADD COLUMN IF NOT EXISTS market_position TEXT,
ADD COLUMN IF NOT EXISTS target_price_msek NUMERIC;

-- Create ai_analysis_audit table for cost tracking
CREATE TABLE IF NOT EXISTS public.ai_analysis_audit (
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
CREATE INDEX IF NOT EXISTS idx_ai_analysis_audit_analysis_id ON public.ai_analysis_audit(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_audit_created_at ON public.ai_analysis_audit(created_at);

-- Add constraints for enum values
ALTER TABLE public.ai_company_analysis 
ADD CONSTRAINT IF NOT EXISTS chk_acquisition_interest 
CHECK (acquisition_interest IN ('Hög', 'Medel', 'Låg') OR acquisition_interest IS NULL);

ALTER TABLE public.ai_company_analysis 
ADD CONSTRAINT IF NOT EXISTS chk_growth_outlook 
CHECK (growth_outlook IN ('Hög', 'Medel', 'Låg') OR growth_outlook IS NULL);

ALTER TABLE public.ai_company_analysis 
ADD CONSTRAINT IF NOT EXISTS chk_market_position 
CHECK (market_position IN ('Marknadsledare', 'Utmanare', 'Följare', 'Nischaktör') OR market_position IS NULL);

ALTER TABLE public.ai_company_analysis 
ADD CONSTRAINT IF NOT EXISTS chk_financial_health_score 
CHECK (financial_health_score >= 1 AND financial_health_score <= 10 OR financial_health_score IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN public.ai_company_analysis.executive_summary IS 'Two-sentence executive summary of company analysis';
COMMENT ON COLUMN public.ai_company_analysis.key_findings IS 'Array of key findings from AI analysis';
COMMENT ON COLUMN public.ai_company_analysis.narrative IS 'Detailed narrative analysis (280-320 words)';
COMMENT ON COLUMN public.ai_company_analysis.strengths IS 'Array of company strengths';
COMMENT ON COLUMN public.ai_company_analysis.weaknesses IS 'Array of company weaknesses';
COMMENT ON COLUMN public.ai_company_analysis.opportunities IS 'Array of growth opportunities';
COMMENT ON COLUMN public.ai_company_analysis.risks IS 'Array of identified risks';
COMMENT ON COLUMN public.ai_company_analysis.acquisition_interest IS 'Acquisition interest level: Hög/Medel/Låg';
COMMENT ON COLUMN public.ai_company_analysis.financial_health_score IS 'Financial health score 1-10';
COMMENT ON COLUMN public.ai_company_analysis.growth_outlook IS 'Growth potential: Hög/Medel/Låg';
COMMENT ON COLUMN public.ai_company_analysis.market_position IS 'Market position: Marknadsledare/Utmanare/Följare/Nischaktör';
COMMENT ON COLUMN public.ai_company_analysis.target_price_msek IS 'Target price in MSEK';

COMMENT ON TABLE public.ai_analysis_audit IS 'Audit trail for AI analysis costs and performance';
COMMENT ON COLUMN public.ai_analysis_audit.prompt_text IS 'Full prompt sent to AI model';
COMMENT ON COLUMN public.ai_analysis_audit.response_text IS 'Full response from AI model';
COMMENT ON COLUMN public.ai_analysis_audit.prompt_tokens IS 'Number of input tokens used';
COMMENT ON COLUMN public.ai_analysis_audit.completion_tokens IS 'Number of output tokens generated';
COMMENT ON COLUMN public.ai_analysis_audit.total_tokens IS 'Total tokens used';
COMMENT ON COLUMN public.ai_analysis_audit.cost_usd IS 'Estimated cost in USD';
COMMENT ON COLUMN public.ai_analysis_audit.latency_ms IS 'Response time in milliseconds';

-- Enable RLS on new audit table
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

-- Update existing ai_company_analysis table to include new fields in persistence function
-- This will be handled by the enhanced server code

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'ai_company_analysis' 
  AND table_schema = 'public'
  AND column_name IN (
    'executive_summary', 'key_findings', 'narrative', 'strengths', 
    'weaknesses', 'opportunities', 'risks', 'acquisition_interest',
    'financial_health_score', 'growth_outlook', 'market_position', 'target_price_msek'
  )
ORDER BY column_name;

-- Verify audit table exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_analysis_audit' 
  AND table_schema = 'public'
ORDER BY column_name;
