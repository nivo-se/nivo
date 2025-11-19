-- Normalized Financial Accounts Table Schema
-- This table stores individual account codes as separate rows for efficient SQL queries
-- Run inside Supabase (Postgres)

-- Create the normalized financial accounts table
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_id uuid NOT NULL REFERENCES public.company_financials(id) ON DELETE CASCADE,
    orgnr text NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    year integer NOT NULL,
    period text NOT NULL,
    account_code text NOT NULL,
    amount_sek numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure one account code per financial period
    CONSTRAINT financial_accounts_unique_account UNIQUE(financial_id, account_code)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_financial_accounts_orgnr_year 
    ON public.financial_accounts(orgnr, year DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_code 
    ON public.financial_accounts(account_code);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_code_year 
    ON public.financial_accounts(account_code, year DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_financial_id 
    ON public.financial_accounts(financial_id);

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_financial_accounts_orgnr_code_year 
    ON public.financial_accounts(orgnr, account_code, year DESC);

-- Index for period-based queries
CREATE INDEX IF NOT EXISTS idx_financial_accounts_year_period 
    ON public.financial_accounts(year DESC, period);

-- Comments for documentation
COMMENT ON TABLE public.financial_accounts IS 
    'Normalized table storing individual account codes as separate rows. 
     Enables efficient SQL queries and calculations for AI analysis.';

COMMENT ON COLUMN public.financial_accounts.financial_id IS 
    'Reference to company_financials record';

COMMENT ON COLUMN public.financial_accounts.account_code IS 
    'Account code (e.g., SDI, RG, DR, EK, FK, etc.)';

COMMENT ON COLUMN public.financial_accounts.amount_sek IS 
    'Amount in SEK (already multiplied by 1000 from raw JSON)';

-- Optional: Create a view for common account code lookups
CREATE OR REPLACE VIEW public.financial_accounts_pivot AS
SELECT 
    fa.orgnr,
    fa.year,
    fa.period,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit_sek,
    MAX(CASE WHEN fa.account_code = 'EBITDA' THEN fa.amount_sek END) as ebitda_sek,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) as equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) as debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) as total_assets_sek,
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) as employees,
    MAX(CASE WHEN fa.account_code = 'EKA' THEN fa.amount_sek END) as equity_ratio,
    MAX(CASE WHEN fa.account_code = 'avk_eget_kapital' THEN fa.amount_sek END) as roe_pct,
    MAX(CASE WHEN fa.account_code = 'avk_totalt_kapital' THEN fa.amount_sek END) as roa_pct
FROM public.financial_accounts fa
GROUP BY fa.orgnr, fa.year, fa.period;

COMMENT ON VIEW public.financial_accounts_pivot IS 
    'Pivoted view of common financial metrics for easy querying';

