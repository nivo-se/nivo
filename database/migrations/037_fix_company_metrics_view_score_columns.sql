-- Ensure company_metrics exposes score columns expected by /api/universe/query.
-- In some environments company_metrics is a view over company_kpis without score fields.
-- This patch makes the view shape compatible by adding default score columns.

CREATE OR REPLACE VIEW public.company_metrics AS
SELECT
  orgnr,
  latest_year,
  latest_revenue_sek,
  latest_profit_sek,
  latest_ebit_sek,
  latest_ebitda_sek,
  revenue_cagr_3y,
  revenue_cagr_5y,
  revenue_growth_yoy,
  avg_ebitda_margin,
  avg_net_margin,
  avg_ebit_margin,
  equity_ratio_latest,
  debt_to_equity_latest,
  revenue_per_employee,
  ebitda_per_employee,
  company_size_bucket,
  growth_bucket,
  profitability_bucket,
  calculated_at,
  updated_at,
  0::integer AS fit_score,
  0::integer AS ops_upside_score,
  0::integer AS nivo_total_score,
  NULL::text AS segment_tier
FROM public.company_kpis;
