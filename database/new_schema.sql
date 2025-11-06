-- New company data schema
-- Run inside Supabase (Postgres)

create extension if not exists "uuid-ossp";

-- 1. Companies master table
create table if not exists public.companies (
    orgnr text primary key,
    company_id text unique,
    company_name text not null,
    company_type text,
    homepage text,
    email text,
    phone text,
    address jsonb,
    segment_names jsonb,
    nace_codes jsonb,
    foundation_year integer,
    employees_latest integer,
    accounts_last_year text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists companies_company_id_idx
    on public.companies(company_id)
    where company_id is not null;

-- 2. Historical financial statements
create table if not exists public.company_financials (
    id uuid primary key default uuid_generate_v4(),
    orgnr text not null references public.companies(orgnr) on delete cascade,
    company_id text,
    year integer not null,
    period text not null,
    period_start date,
    period_end date,
    currency text not null default 'SEK',
    revenue_sek numeric,
    profit_sek numeric,
    ebitda_sek numeric,
    equity_sek numeric,
    debt_sek numeric,
    employees integer,
    account_codes jsonb,
    raw_json jsonb,
    scraped_at timestamptz not null default now(),
    source_job_id text
);

create unique index if not exists company_financials_unique_period
    on public.company_financials(orgnr, year, period);

create index if not exists company_financials_year_idx
    on public.company_financials(year desc);

-- 3. Derived metrics per company
create table if not exists public.company_metrics (
    orgnr text primary key references public.companies(orgnr) on delete cascade,
    latest_year integer,
    latest_revenue_sek numeric,
    latest_profit_sek numeric,
    latest_ebitda_sek numeric,
    revenue_cagr_3y numeric,
    revenue_cagr_5y numeric,
    avg_ebitda_margin numeric,
    avg_net_margin numeric,
    equity_ratio_latest numeric,
    debt_to_equity_latest numeric,
    revenue_per_employee numeric,
    ebitda_per_employee numeric,
    digital_presence boolean,
    company_size_bucket text,
    growth_bucket text,
    profitability_bucket text,
    calculated_at timestamptz not null default now(),
    source_job_id text
);

-- Optional helper indexes
create index if not exists company_metrics_latest_year_idx
    on public.company_metrics(latest_year desc);


