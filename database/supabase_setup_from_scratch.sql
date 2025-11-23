-- ============================================================================
-- Supabase Database Setup from Scratch
-- ============================================================================
-- This script creates all necessary tables for the Nivo AI Sourcing Tool
-- Run this in Supabase SQL Editor when ready to migrate from local SQLite
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. COMPANIES TABLE (Base company data)
-- ============================================================================
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

-- ============================================================================
-- 2. FINANCIALS TABLE (Historical financial data)
-- ============================================================================
-- Note: This matches the local SQLite structure with account codes as columns
-- For Supabase, we'll use a flexible JSONB approach for account codes
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
    
    -- Core financial metrics (most commonly used)
    si_sek NUMERIC,              -- Net Revenue (Nettoomsättning) - PREFERRED
    sdi_sek NUMERIC,             -- Total Revenue (Omsättning)
    dr_sek NUMERIC,              -- Net Profit (Årets resultat)
    resultat_e_avskrivningar_sek NUMERIC,  -- EBIT (Rörelseresultat efter avskrivningar) - PREFERRED
    ebitda_sek NUMERIC,          -- EBITDA (Rörelseresultat före avskrivningar)
    ors_sek NUMERIC,             -- Operating Result (fallback for EBITDA)
    
    -- Additional account codes stored as JSONB for flexibility
    account_codes JSONB,
    
    -- Metadata
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

-- ============================================================================
-- 3. COMPANY_KPIS TABLE (Derived metrics and aggregations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company_kpis (
    orgnr TEXT PRIMARY KEY REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    
    -- Latest year metrics
    latest_year INTEGER,
    latest_revenue_sek NUMERIC,
    latest_profit_sek NUMERIC,
    latest_ebit_sek NUMERIC,
    latest_ebitda_sek NUMERIC,
    
    -- Growth metrics
    revenue_cagr_3y NUMERIC,
    revenue_cagr_5y NUMERIC,
    revenue_growth_yoy NUMERIC,
    
    -- Profitability metrics (weighted averages)
    avg_ebitda_margin NUMERIC,  -- Weighted average: total EBITDA / total revenue
    avg_net_margin NUMERIC,      -- Weighted average: total profit / total revenue
    avg_ebit_margin NUMERIC,     -- Weighted average: total EBIT / total revenue
    
    -- Financial health
    equity_ratio_latest NUMERIC,
    debt_to_equity_latest NUMERIC,
    
    -- Efficiency metrics
    revenue_per_employee NUMERIC,
    ebitda_per_employee NUMERIC,
    
    -- Buckets for filtering
    company_size_bucket TEXT,      -- 'small', 'medium', 'large'
    growth_bucket TEXT,            -- 'declining', 'stable', 'growing', 'high_growth'
    profitability_bucket TEXT,      -- 'loss_making', 'low_margin', 'profitable', 'high_margin'
    
    -- Metadata
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

-- ============================================================================
-- 4. AI_PROFILES TABLE (AI enrichment results)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_number TEXT NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    
    -- Basic enrichment
    website TEXT,
    product_description TEXT,
    end_market TEXT,
    customer_types TEXT,
    value_chain_position TEXT,
    business_model_summary TEXT,
    
    -- Industry classification
    industry_sector TEXT,
    industry_subsector TEXT,
    market_regions JSONB,  -- Array of regions/markets
    
    -- Strategic analysis
    strategic_fit_score INTEGER,      -- 1-10
    defensibility_score INTEGER,      -- 1-10
    risk_flags JSONB,                 -- Array of risk flags
    upside_potential TEXT,
    fit_rationale TEXT,
    
    -- Strategic playbook
    strategic_playbook TEXT,          -- Markdown formatted playbook
    next_steps JSONB,                -- Array of actionable next steps
    
    -- AI metadata
    ai_notes TEXT,
    agent_type TEXT,                  -- Which AI agent was used (default, tech_focused, etc.)
    scraped_pages JSONB,              -- Array of URLs that were scraped
    enrichment_status TEXT DEFAULT 'pending',  -- 'pending', 'complete', 'failed'
    
    -- Timestamps
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- ============================================================================
-- 5. AI_QUERIES TABLE (AI filter query history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_prompt TEXT NOT NULL,
    parsed_sql TEXT,
    result_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at
    ON public.ai_queries(created_at DESC);

-- ============================================================================
-- 6. SAVED_COMPANY_LISTS TABLE (User saved lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_company_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- References auth.users(id)
    name TEXT NOT NULL,
    description TEXT,
    companies JSONB NOT NULL,  -- Array of company objects
    filters JSONB,            -- Saved filter criteria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_company_lists_user_id
    ON public.saved_company_lists(user_id, created_at DESC);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) Policies
-- ============================================================================
-- Enable RLS on tables that need user-specific access
ALTER TABLE public.saved_company_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own saved lists
CREATE POLICY "Users can view own saved lists"
    ON public.saved_company_lists
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved lists"
    ON public.saved_company_lists
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved lists"
    ON public.saved_company_lists
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved lists"
    ON public.saved_company_lists
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for companies table
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for company_kpis table
CREATE TRIGGER update_company_kpis_updated_at
    BEFORE UPDATE ON public.company_kpis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for saved_company_lists table
CREATE TRIGGER update_saved_company_lists_updated_at
    BEFORE UPDATE ON public.saved_company_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Setup Complete!
-- ============================================================================
-- Next steps:
-- 1. Verify all tables were created: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- 2. Import data from local SQLite using migration scripts
-- 3. Update DATABASE_SOURCE=supabase in .env
-- ============================================================================

