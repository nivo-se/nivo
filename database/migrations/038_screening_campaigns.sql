-- Screening campaigns: Layer 0+ orchestration for universe shortlists (see docs/deep_research/SCREENING_ORCHESTRATOR_SPEC.md)

CREATE TABLE IF NOT EXISTS public.screening_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    profile_id UUID NOT NULL REFERENCES public.screening_profiles(id) ON DELETE RESTRICT,
    profile_version_id UUID REFERENCES public.screening_profile_versions(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    config_snapshot_json JSONB NOT NULL DEFAULT '{}',
    params_json JSONB NOT NULL DEFAULT '{}',
    mandate_hash TEXT,
    created_by_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    current_stage TEXT,
    stats_json JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_screening_campaigns_profile ON public.screening_campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_screening_campaigns_status ON public.screening_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_screening_campaigns_created ON public.screening_campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS public.screening_campaign_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.screening_campaigns(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    stats_json JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    UNIQUE (campaign_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_screening_campaign_stages_campaign ON public.screening_campaign_stages(campaign_id);

CREATE TABLE IF NOT EXISTS public.screening_campaign_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.screening_campaigns(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    layer0_rank INT,
    profile_weighted_score NUMERIC,
    archetype_code TEXT,
    relevance_status TEXT,
    relevance_json JSONB,
    fit_json JSONB,
    fit_total NUMERIC,
    combined_score NUMERIC,
    final_rank INT,
    is_selected BOOLEAN NOT NULL DEFAULT false,
    deep_research_run_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_screening_campaign_candidates_unique
    ON public.screening_campaign_candidates(campaign_id, orgnr);

CREATE INDEX IF NOT EXISTS idx_screening_campaign_candidates_campaign ON public.screening_campaign_candidates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_screening_campaign_candidates_selected ON public.screening_campaign_candidates(campaign_id, is_selected) WHERE is_selected = true;

COMMENT ON TABLE public.screening_campaigns IS 'Universe screening campaign (profile-weighted shortlist + future LLM stages)';
COMMENT ON TABLE public.screening_campaign_candidates IS 'Per-company campaign results; Layer 0 = deterministic rank';
