-- ============================================================================
-- Deprecate Wrong Columns and Create Reliable Views
-- ============================================================================
-- All *_sek columns in company_financials are wrong (1000x too small)
-- This migration deprecates them and creates views that use account_codes
-- ============================================================================

-- Step 1: Add deprecation comments to wrong columns
COMMENT ON COLUMN public.company_financials.revenue_sek IS 
'⚠️ DEPRECATED: Contains incorrect values (1000x too small). Use account_codes->>''SDI'' or financial_accounts table instead.';

COMMENT ON COLUMN public.company_financials.profit_sek IS 
'⚠️ DEPRECATED: Contains incorrect values (1000x too small). Use account_codes->>''DR'' or financial_accounts table instead.';

COMMENT ON COLUMN public.company_financials.ebitda_sek IS 
'⚠️ DEPRECATED: Contains incorrect values (1000x too small). Use account_codes->>''EBITDA'' or financial_accounts table instead.';

COMMENT ON COLUMN public.company_financials.equity_sek IS 
'⚠️ DEPRECATED: Contains incorrect values (1000x too small). Use account_codes->>''EK'' or financial_accounts table instead.';

COMMENT ON COLUMN public.company_financials.debt_sek IS 
'⚠️ DEPRECATED: Contains incorrect values (1000x too small). Use account_codes->>''FK'' or financial_accounts table instead.';

-- Step 2: Create reliable view that uses account_codes as source of truth
-- Note: account_codes values are stored in SEK (not thousands)
-- For MSEK: divide by 1,000,000
CREATE OR REPLACE VIEW public.company_financials_reliable AS
SELECT 
    id,
    orgnr,
    company_id,
    year,
    period,
    period_start,
    period_end,
    currency,
    -- Use account_codes as source of truth (values in SEK, same as original columns)
    -- These match the expected format: values in thousands for display
    (account_codes->>'SDI')::numeric as revenue_sek,
    (account_codes->>'DR')::numeric as profit_sek,
    (account_codes->>'EBITDA')::numeric as ebitda_sek,
    (account_codes->>'EK')::numeric as equity_sek,
    (account_codes->>'FK')::numeric as debt_sek,
    employees,
    account_codes,
    raw_json,
    scraped_at,
    source_job_id
FROM public.company_financials
WHERE account_codes IS NOT NULL;

COMMENT ON VIEW public.company_financials_reliable IS 
'Reliable view of company_financials using account_codes JSONB as source of truth. All *_sek columns come from account_codes, not the deprecated direct columns. Values are in SEK (same format as original columns expected).';

-- Step 3: Create helper function to get account code value
CREATE OR REPLACE FUNCTION public.get_account_code(
    p_account_codes jsonb,
    p_code text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN (p_account_codes->>p_code)::numeric;
END;
$$;

COMMENT ON FUNCTION public.get_account_code IS 
'Helper function to safely extract account code values from JSONB. Returns NULL if code not found.';

-- Step 4: Update company_metrics to use correct source
-- Note: company_metrics.latest_*_sek columns should be populated from account_codes
-- This is a view/function to calculate them correctly

CREATE OR REPLACE VIEW public.company_metrics_reliable AS
SELECT 
    cm.orgnr,
    cm.latest_year,
    -- Use account_codes from latest financial record
    (SELECT (account_codes->>'SDI')::numeric 
     FROM company_financials cf 
     WHERE cf.orgnr = cm.orgnr 
     ORDER BY cf.year DESC, cf.period DESC 
     LIMIT 1) as latest_revenue_sek,
    (SELECT (account_codes->>'DR')::numeric 
     FROM company_financials cf 
     WHERE cf.orgnr = cm.orgnr 
     ORDER BY cf.year DESC, cf.period DESC 
     LIMIT 1) as latest_profit_sek,
    (SELECT (account_codes->>'EBITDA')::numeric 
     FROM company_financials cf 
     WHERE cf.orgnr = cm.orgnr 
     ORDER BY cf.year DESC, cf.period DESC 
     LIMIT 1) as latest_ebitda_sek,
    -- Keep other metrics columns as-is
    cm.revenue_cagr_3y,
    cm.revenue_cagr_5y,
    cm.avg_ebitda_margin,
    cm.avg_net_margin,
    cm.equity_ratio_latest,
    cm.debt_to_equity_latest,
    cm.revenue_per_employee,
    cm.ebitda_per_employee,
    cm.digital_presence,
    cm.company_size_bucket,
    cm.growth_bucket,
    cm.profitability_bucket,
    cm.calculated_at,
    cm.source_job_id,
    -- Segmentation scores
    cm.fit_score,
    cm.ops_upside_score,
    cm.nivo_total_score,
    cm.segment_tier
FROM public.company_metrics cm;

COMMENT ON VIEW public.company_metrics_reliable IS 
'Reliable view of company_metrics with latest_*_sek columns calculated from account_codes instead of deprecated direct columns.';

-- Step 5: Create comprehensive financial data view
CREATE OR REPLACE VIEW public.company_financials_complete AS
SELECT 
    cf.id,
    cf.orgnr,
    cf.company_id,
    cf.year,
    cf.period,
    cf.period_start,
    cf.period_end,
    cf.currency,
    -- Revenue and profitability (from account_codes)
    (cf.account_codes->>'SDI')::numeric as revenue_sek,
    (cf.account_codes->>'RG')::numeric as ebit_sek,
    (cf.account_codes->>'DR')::numeric as profit_sek,
    (cf.account_codes->>'EBITDA')::numeric as ebitda_sek,
    -- Balance sheet (from account_codes)
    (cf.account_codes->>'EK')::numeric as equity_sek,
    (cf.account_codes->>'FK')::numeric as debt_sek,
    (cf.account_codes->>'SV')::numeric as total_assets_sek,
    -- Employees
    cf.employees,
    (cf.account_codes->>'ANT')::numeric as employees_from_accounts,
    -- Ratios (from account_codes if available)
    (cf.account_codes->>'EKA')::numeric as equity_ratio_pct,
    (cf.account_codes->>'avk_eget_kapital')::numeric as roe_pct,
    (cf.account_codes->>'avk_totalt_kapital')::numeric as roa_pct,
    -- Metadata
    cf.account_codes,
    cf.raw_json,
    cf.scraped_at,
    cf.source_job_id
FROM public.company_financials cf
WHERE cf.account_codes IS NOT NULL;

COMMENT ON VIEW public.company_financials_complete IS 
'Complete financial data view using account_codes as single source of truth. All financial metrics extracted from account_codes JSONB field.';

-- Step 6: Create index on account_codes for better performance
CREATE INDEX IF NOT EXISTS idx_company_financials_account_codes_gin 
    ON public.company_financials USING GIN (account_codes);

COMMENT ON INDEX idx_company_financials_account_codes_gin IS 
'GIN index on account_codes JSONB for efficient queries on account code values.';

