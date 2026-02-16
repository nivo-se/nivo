-- Extend coverage_metrics with financial columns for Universe investable view
-- Sources: company_kpis (revenue, margin, CAGR), companies (employees_latest)
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
  -- Financial columns from company_kpis
  ck.latest_revenue_sek AS revenue_latest,
  ck.avg_ebitda_margin AS ebitda_margin_latest,
  ck.revenue_cagr_3y AS revenue_cagr_3y,
  c.employees_latest AS employees_latest
FROM public.companies c
LEFT JOIN public.ai_profiles a ON c.orgnr = a.org_number
LEFT JOIN public.company_kpis ck ON ck.orgnr = c.orgnr;

COMMENT ON VIEW public.coverage_metrics IS 'Data coverage + financial metrics per company for Universe: orgnr, name, segment_names, has_homepage, has_ai_profile, has_3y_financials, last_enriched_at, data_quality_score, revenue_latest, ebitda_margin_latest, revenue_cagr_3y, employees_latest.';
