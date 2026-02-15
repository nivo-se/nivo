-- Migration: Enhance AI profiles with richer analysis fields
-- Description: adds columns required by the deep AI workstream (industry, market, playbook, metadata)

alter table if exists public.ai_profiles
    add column if not exists industry_sector text,
    add column if not exists industry_subsector text,
    add column if not exists market_regions jsonb,
    add column if not exists business_model_summary text,
    add column if not exists risk_flags jsonb,
    add column if not exists upside_potential text,
    add column if not exists strategic_playbook text,
    add column if not exists next_steps jsonb,
    add column if not exists agent_type text,
    add column if not exists scraped_pages jsonb,
    add column if not exists fit_rationale text;

create index if not exists idx_ai_profiles_industry_sector
    on public.ai_profiles(industry_sector nulls last);

create index if not exists idx_ai_profiles_agent_type
    on public.ai_profiles(agent_type nulls last);


