-- Migration: Create AI sourcing support tables
-- Description: adds ai_profiles and ai_queries tables for the new AI-first workflow

create extension if not exists "uuid-ossp";

create table if not exists public.ai_profiles (
    id uuid primary key default uuid_generate_v4(),
    org_number text references public.companies(orgnr) on delete cascade,
    website text,
    product_description text,
    end_market text,
    customer_types text,
    strategic_fit_score integer,
    defensibility_score integer,
    value_chain_position text,
    ai_notes text,
    enrichment_status text default 'pending',
    last_updated timestamptz not null default now()
);

create unique index if not exists idx_ai_profiles_org_number
    on public.ai_profiles(org_number);

create index if not exists idx_ai_profiles_last_updated
    on public.ai_profiles(last_updated desc);

create index if not exists idx_ai_profiles_strategic_fit
    on public.ai_profiles(strategic_fit_score desc nulls last);

create table if not exists public.ai_queries (
    id uuid primary key default uuid_generate_v4(),
    user_prompt text not null,
    parsed_sql text,
    result_count integer,
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_queries_created_at
    on public.ai_queries(created_at desc);

