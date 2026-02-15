-- Create tables for Stage 1 and Stage 2 shortlists
-- These are system-generated shortlists (not user-saved lists)

-- Stage 1 shortlists (financial filtering results)
CREATE TABLE IF NOT EXISTS public.stage1_shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    weights_json JSONB NOT NULL, -- The filter weights used
    stage_one_size INTEGER NOT NULL,
    companies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {orgnr, name, revenue, growth, ebit_margin, composite_score}
    total_companies INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by TEXT, -- User ID or system
    status TEXT DEFAULT 'active' -- 'active', 'archived', 'used_for_stage2'
);

CREATE INDEX IF NOT EXISTS idx_stage1_shortlists_generated_at ON public.stage1_shortlists(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage1_shortlists_status ON public.stage1_shortlists(status);

-- Stage 2 shortlists (AI screening results)
CREATE TABLE IF NOT EXISTS public.stage2_shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage1_shortlist_id UUID REFERENCES public.stage1_shortlists(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    companies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of companies with AI screening scores
    total_companies INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by TEXT,
    status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_stage2_shortlists_stage1_id ON public.stage2_shortlists(stage1_shortlist_id);
CREATE INDEX IF NOT EXISTS idx_stage2_shortlists_generated_at ON public.stage2_shortlists(generated_at DESC);

-- Add comments
COMMENT ON TABLE public.stage1_shortlists IS 'Stage 1 shortlists generated from financial filtering';
COMMENT ON TABLE public.stage2_shortlists IS 'Stage 2 shortlists generated from AI screening of Stage 1 results';

