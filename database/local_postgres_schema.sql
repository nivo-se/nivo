-- Local Postgres schema for Nivo development (Docker)
-- Derived from supabase_setup_from_scratch.sql, without RLS (no Supabase Auth)
-- Used by: scripts/bootstrap_postgres_schema.py

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
    orgnr TEXT PRIMARY KEY,
    company_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    company_type TEXT,
    homepage TEXT,
    email TEXT,
    phone TEXT,
    address JSONB,
    segment_names JSONB,
    nace_codes JSONB,
    nace_categories JSONB,
    foundation_year INTEGER,
    employees_latest INTEGER,
    accounts_last_year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_company_id_idx
    ON public.companies(company_id)
    WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_company_name_idx
    ON public.companies(company_name);

CREATE INDEX IF NOT EXISTS companies_segment_names_idx
    ON public.companies USING GIN(segment_names);

-- Add nace_categories for SQLite compat (populated from nace_codes)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS nace_categories JSONB;
UPDATE public.companies SET nace_categories = nace_codes WHERE nace_categories IS NULL AND nace_codes IS NOT NULL;

-- 2. FINANCIALS
CREATE TABLE IF NOT EXISTS public.financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orgnr TEXT NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    company_id TEXT,
    year INTEGER NOT NULL,
    period TEXT NOT NULL DEFAULT '12',
    period_start DATE,
    period_end DATE,
    currency TEXT DEFAULT 'SEK',
    employees INTEGER,
    si_sek NUMERIC,
    sdi_sek NUMERIC,
    dr_sek NUMERIC,
    resultat_e_avskrivningar_sek NUMERIC,
    ebitda_sek NUMERIC,
    ors_sek NUMERIC,
    account_codes JSONB,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(orgnr, year, period)
);

CREATE INDEX IF NOT EXISTS financials_orgnr_year_idx
    ON public.financials(orgnr, year DESC);

CREATE INDEX IF NOT EXISTS financials_year_idx
    ON public.financials(year DESC);

CREATE INDEX IF NOT EXISTS financials_si_sek_idx
    ON public.financials(si_sek) WHERE si_sek IS NOT NULL;

-- 3. COMPANY_KPIS
CREATE TABLE IF NOT EXISTS public.company_kpis (
    orgnr TEXT PRIMARY KEY REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    latest_year INTEGER,
    latest_revenue_sek NUMERIC,
    latest_profit_sek NUMERIC,
    latest_ebit_sek NUMERIC,
    latest_ebitda_sek NUMERIC,
    revenue_cagr_3y NUMERIC,
    revenue_cagr_5y NUMERIC,
    revenue_growth_yoy NUMERIC,
    avg_ebitda_margin NUMERIC,
    avg_net_margin NUMERIC,
    avg_ebit_margin NUMERIC,
    equity_ratio_latest NUMERIC,
    debt_to_equity_latest NUMERIC,
    revenue_per_employee NUMERIC,
    ebitda_per_employee NUMERIC,
    company_size_bucket TEXT,
    growth_bucket TEXT,
    profitability_bucket TEXT,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_kpis_latest_year_idx
    ON public.company_kpis(latest_year DESC);

CREATE INDEX IF NOT EXISTS company_kpis_revenue_cagr_idx
    ON public.company_kpis(revenue_cagr_3y DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS company_kpis_size_bucket_idx
    ON public.company_kpis(company_size_bucket);

CREATE INDEX IF NOT EXISTS company_kpis_growth_bucket_idx
    ON public.company_kpis(growth_bucket);

CREATE INDEX IF NOT EXISTS company_kpis_profitability_bucket_idx
    ON public.company_kpis(profitability_bucket);

-- 4. company_metrics view (alias for stage1_filter, workflow, chat compatibility)
CREATE OR REPLACE VIEW public.company_metrics AS SELECT * FROM public.company_kpis;

-- 5. AI_PROFILES
CREATE TABLE IF NOT EXISTS public.ai_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_number TEXT NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    website TEXT,
    product_description TEXT,
    end_market TEXT,
    customer_types TEXT,
    value_chain_position TEXT,
    business_model_summary TEXT,
    business_summary TEXT,
    industry_sector TEXT,
    industry_subsector TEXT,
    market_regions JSONB,
    industry_keywords JSONB,
    strategic_fit_score INTEGER,
    defensibility_score INTEGER,
    risk_flags JSONB,
    upside_potential TEXT,
    acquisition_angle TEXT,
    fit_rationale TEXT,
    strategic_playbook TEXT,
    next_steps JSONB,
    ai_notes TEXT,
    agent_type TEXT,
    scraped_pages JSONB,
    enrichment_status TEXT DEFAULT 'pending',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_scraped TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_profiles_org_number
    ON public.ai_profiles(org_number);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_last_updated
    ON public.ai_profiles(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_strategic_fit
    ON public.ai_profiles(strategic_fit_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_industry_sector
    ON public.ai_profiles(industry_sector NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_agent_type
    ON public.ai_profiles(agent_type NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_enrichment_status
    ON public.ai_profiles(enrichment_status);

-- 6. AI_QUERIES
CREATE TABLE IF NOT EXISTS public.ai_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_prompt TEXT NOT NULL,
    parsed_sql TEXT,
    result_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at
    ON public.ai_queries(created_at DESC);

-- 7. SAVED_COMPANY_LISTS (no RLS for local dev)
CREATE TABLE IF NOT EXISTS public.saved_company_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    companies JSONB NOT NULL,
    filters JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_company_lists_user_id
    ON public.saved_company_lists(user_id, created_at DESC);

-- 8. ENRICHMENT_RUNS + COMPANY_ENRICHMENT (V2 AI import, Step 4)
CREATE TABLE IF NOT EXISTS public.enrichment_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT,
    model TEXT,
    provider TEXT,
    prompt_version TEXT,
    meta JSONB
);

CREATE TABLE IF NOT EXISTS public.company_enrichment (
    orgnr TEXT NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    run_id UUID REFERENCES public.enrichment_runs(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    result JSONB NOT NULL,
    score NUMERIC,
    tags JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (orgnr, run_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_company_enrichment_orgnr ON public.company_enrichment(orgnr);
CREATE INDEX IF NOT EXISTS idx_company_enrichment_kind ON public.company_enrichment(kind);
CREATE INDEX IF NOT EXISTS idx_company_enrichment_orgnr_kind ON public.company_enrichment(orgnr, kind);
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_created_at ON public.enrichment_runs(created_at DESC);
