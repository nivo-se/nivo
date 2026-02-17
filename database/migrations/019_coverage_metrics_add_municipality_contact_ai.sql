-- Extend coverage_metrics with municipality, contact (homepage, email, phone), and AI score
-- For Universe geography + contact fallback + AI badge
-- Idempotent: DROP before CREATE

DROP VIEW IF EXISTS public.coverage_metrics CASCADE;

CREATE VIEW public.coverage_metrics AS
SELECT
  c.orgnr,
  c.company_name AS name,
  c.segment_names,
  (c.homepage IS NOT NULL AND c.homepage != '') AS has_homepage,
  (a.org_number IS NOT NULL) AS has_ai_profile,
  (SELECT COUNT(DISTINCT f.year) FROM public.financials f
   WHERE f.orgnr = c.orgnr) >= 3 AS has_3y_financials,
  a.last_updated AS last_enriched_at,
  (
    CASE WHEN (c.homepage IS NOT NULL AND c.homepage != '') THEN 1 ELSE 0 END +
    CASE WHEN a.org_number IS NOT NULL THEN 2 ELSE 0 END +
    (CASE WHEN (SELECT COUNT(DISTINCT f.year) FROM public.financials f WHERE f.orgnr = c.orgnr) >= 3 THEN 1 ELSE 0 END)
  )::int AS data_quality_score,
  ck.latest_revenue_sek AS revenue_latest,
  ck.avg_ebitda_margin AS ebitda_margin_latest,
  ck.revenue_cagr_3y AS revenue_cagr_3y,
  c.employees_latest AS employees_latest,
  (a.last_updated IS NULL OR a.last_updated < NOW() - INTERVAL '180 days') AS is_stale,
  -- geography
  COALESCE(c.address->>'municipality', c.address->>'region') AS municipality,
  -- contact (for fallback when batch unavailable)
  c.homepage,
  c.email,
  c.phone,
  -- AI
  a.strategic_fit_score AS ai_strategic_fit_score,
  -- balance sheet metrics (for Company Profile fallback)
  ck.equity_ratio_latest,
  ck.debt_to_equity_latest
FROM public.companies c
LEFT JOIN public.ai_profiles a ON c.orgnr = a.org_number
LEFT JOIN public.company_kpis ck ON ck.orgnr = c.orgnr;

COMMENT ON VIEW public.coverage_metrics IS 'Data coverage + financial metrics + municipality, contact, AI score for Universe.';
