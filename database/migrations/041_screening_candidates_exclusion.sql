-- Mark candidates excluded from downstream analysis (e.g. head office / wrong entity).
ALTER TABLE public.screening_campaign_candidates
  ADD COLUMN IF NOT EXISTS excluded_from_analysis BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT NULL;

COMMENT ON COLUMN public.screening_campaign_candidates.excluded_from_analysis IS 'Human flag: skip this org in further screening / deep-research stages';
COMMENT ON COLUMN public.screening_campaign_candidates.exclusion_reason IS 'Optional note (e.g. head office, holding shell)';

CREATE INDEX IF NOT EXISTS idx_screening_campaign_candidates_excluded
  ON public.screening_campaign_candidates (campaign_id, excluded_from_analysis)
  WHERE excluded_from_analysis = true;
