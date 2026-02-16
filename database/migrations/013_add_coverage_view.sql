-- Migration: Coverage metrics view for Data Coverage Mode
-- Powers "what do we know vs don't know" in Universe and Home
-- Idempotent: DROP before CREATE so re-running migrations works (014/016/017 extend this view)

DROP VIEW IF EXISTS public.coverage_metrics CASCADE;

-- View: coverage_metrics
-- Columns: orgnr, has_homepage, has_ai_profile, has_3y_financials, last_enriched_at, data_quality_score
CREATE VIEW public.coverage_metrics AS
SELECT
  c.orgnr,
  (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
  (a.org_number IS NOT NULL) AS has_ai_profile,
  (SELECT COUNT(DISTINCT f.year) FROM public.financials f
   WHERE f.orgnr = c.orgnr) >= 3 AS has_3y_financials,
  a.last_updated AS last_enriched_at,
  (
    CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END +
    CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END +
    CASE WHEN (SELECT COUNT(DISTINCT f.year) FROM public.financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END
  )::int AS data_quality_score
FROM public.companies c
LEFT JOIN public.ai_profiles a ON c.orgnr = a.org_number;

-- Staleness: last_enriched_at < 180 days ago = fresh
COMMENT ON VIEW public.coverage_metrics IS 'Data coverage per company: has_homepage, has_ai_profile, has_3y_financials, last_enriched_at, data_quality_score (0-4).';
