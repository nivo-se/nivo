-- Migration: Screening profiles and versions for Layer 1 deterministic screening
-- Profiles hold versioned config (variables, weights, archetypes, exclusion_rules)

-- 1. SCREENING_PROFILES
CREATE TABLE IF NOT EXISTS public.screening_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('private', 'team')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_profiles_owner ON public.screening_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_screening_profiles_scope ON public.screening_profiles(scope);

-- 2. SCREENING_PROFILE_VERSIONS
CREATE TABLE IF NOT EXISTS public.screening_profile_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.screening_profiles(id) ON DELETE CASCADE,
    version INT NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_screening_profile_versions_profile ON public.screening_profile_versions(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_screening_profile_versions_profile_version ON public.screening_profile_versions(profile_id, version);
CREATE INDEX IF NOT EXISTS idx_screening_profile_versions_active ON public.screening_profile_versions(profile_id, is_active) WHERE is_active = true;

-- Trigger: only one active version per profile (enforced in app; optional partial unique index)
-- We allow multiple is_active=true for simplicity; app sets one active when activating.

COMMENT ON TABLE public.screening_profiles IS 'Layer 1 screening profiles (named configs for variables, weights, exclusion rules)';
COMMENT ON TABLE public.screening_profile_versions IS 'Versioned screening config (config_json: variables, weights, archetypes, exclusion_rules)';
