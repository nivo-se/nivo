-- Migration: Link saved_views to optional screening profile (Layer 1)
-- When set, the view is scoped to that profile for display/query.

ALTER TABLE public.saved_views
ADD COLUMN IF NOT EXISTS screening_profile_id UUID NULL REFERENCES public.screening_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_views_screening_profile ON public.saved_views(screening_profile_id) WHERE screening_profile_id IS NOT NULL;

COMMENT ON COLUMN public.saved_views.screening_profile_id IS 'Optional screening profile this view is associated with (Layer 1).';
