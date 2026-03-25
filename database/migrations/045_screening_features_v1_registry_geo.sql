-- Extra registry/location context for screening export + GPT website retrieval (read-only view).
-- New columns are APPENDED so CREATE OR REPLACE VIEW does not reinterpret existing ordinals.
-- registry_homepage_url: Allabolag-style homepage when present.
-- address_*: from companies.address JSONB (city/municipality and county/region aliases).

CREATE OR REPLACE VIEW public.screening_features_v1 AS
SELECT
  c.orgnr,
  c.company_name,
  c.employees_latest,
  (c.homepage IS NOT NULL AND btrim(c.homepage) <> '') AS has_homepage,
  CASE
    WHEN c.nace_codes IS NULL THEN NULL::text
    ELSE (c.nace_codes::jsonb->>0)
  END AS primary_nace,
  cm.latest_year,
  cm.latest_revenue_sek,
  cm.revenue_cagr_3y,
  cm.revenue_growth_yoy,
  cm.avg_ebitda_margin,
  cm.avg_ebit_margin,
  cm.avg_net_margin,
  cm.equity_ratio_latest,
  cm.debt_to_equity_latest,
  cm.revenue_per_employee,
  cm.ebitda_per_employee,
  cm.company_size_bucket,
  cm.growth_bucket,
  cm.profitability_bucket,
  cm.fit_score,
  cm.ops_upside_score,
  cm.nivo_total_score,
  cm.segment_tier,
  NULLIF(btrim(c.homepage), '') AS registry_homepage_url,
  NULLIF(
    btrim(COALESCE(c.address->>'city', c.address->>'municipality', '')),
    ''
  ) AS address_city,
  NULLIF(
    btrim(COALESCE(c.address->>'county', c.address->>'region', '')),
    ''
  ) AS address_region,
  NULLIF(btrim(COALESCE(c.address->>'country', '')), '') AS address_country,
  CASE
    WHEN c.segment_names IS NULL THEN NULL::text
    ELSE c.segment_names::text
  END AS segment_labels_json
FROM public.companies c
LEFT JOIN public.company_metrics cm ON cm.orgnr = c.orgnr;

COMMENT ON VIEW public.screening_features_v1 IS
  'Screening v1: KPIs + registry homepage, address hints, segment labels (append) for URL retrieval.';
