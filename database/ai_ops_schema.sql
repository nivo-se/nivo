-- Schema definition for AI analytics persistence.
-- Run inside Supabase SQL editor or via migration tooling.

create schema if not exists ai_ops;

-- Run metadata capturing who triggered an analysis batch and its lifecycle.
create table if not exists ai_ops.ai_analysis_runs (
    id uuid primary key,
    initiated_by text,
    status text not null default 'pending',
    model_version text not null,
    analysis_mode text not null default 'deep',
    filters_json jsonb,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    error_message text,
    created_at timestamptz not null default now()
);

create index if not exists ai_analysis_runs_status_idx
    on ai_ops.ai_analysis_runs (status, started_at desc);

-- Headline results per company per run.
create table if not exists ai_ops.ai_company_analysis (
    id bigserial primary key,
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    company_name text,
    summary text,
    recommendation text,
    confidence numeric,
    risk_score numeric,
    financial_grade text,
    commercial_grade text,
    operational_grade text,
    next_steps jsonb,
    created_at timestamptz not null default now(),
    unique (run_id, orgnr)
);

create index if not exists ai_company_analysis_orgnr_idx
    on ai_ops.ai_company_analysis (orgnr, created_at desc);

-- Narrative building blocks and supporting notes.
create table if not exists ai_ops.ai_analysis_sections (
    id bigserial primary key,
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    section_type text not null,
    title text,
    content_md text not null,
    supporting_metrics jsonb,
    confidence numeric,
    tokens_used integer,
    created_at timestamptz not null default now()
);

create index if not exists ai_analysis_sections_lookup_idx
    on ai_ops.ai_analysis_sections (run_id, orgnr, section_type);

-- Extracted metrics that power dashboards and validations.
create table if not exists ai_ops.ai_analysis_metrics (
    id bigserial primary key,
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    metric_name text not null,
    metric_value numeric,
    metric_unit text,
    source text,
    year integer,
    confidence numeric,
    created_at timestamptz not null default now()
);

create index if not exists ai_analysis_metrics_lookup_idx
    on ai_ops.ai_analysis_metrics (orgnr, metric_name, year desc);

-- Prompt/response storage for audits and debugging.
create table if not exists ai_ops.ai_analysis_audit (
    id bigserial primary key,
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    module text not null,
    prompt text,
    response text,
    model text,
    latency_ms integer,
    prompt_tokens integer,
    completion_tokens integer,
    cost_usd numeric,
    created_at timestamptz not null default now()
);

create index if not exists ai_analysis_audit_run_idx
    on ai_ops.ai_analysis_audit (run_id, orgnr, module);

-- Screening results for rapid assessment of company lists.
create table if not exists ai_ops.ai_screening_results (
    id uuid primary key default gen_random_uuid(),
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    company_name text,
    screening_score numeric,
    risk_flag text,
    brief_summary text,
    created_at timestamptz default now()
);

create index if not exists ai_screening_results_run_idx
    on ai_ops.ai_screening_results (run_id, screening_score desc);

create index if not exists ai_screening_results_orgnr_idx
    on ai_ops.ai_screening_results (orgnr, created_at desc);

-- Convenience view surfaces the latest completed analysis per company.
create or replace view ai_ops.ai_company_analysis_latest as
select distinct on (orgnr)
    orgnr,
    company_name,
    summary,
    recommendation,
    confidence,
    risk_score,
    financial_grade,
    commercial_grade,
    operational_grade,
    next_steps,
    run_id,
    ai_company_analysis.created_at
from ai_ops.ai_company_analysis
join ai_ops.ai_analysis_runs on ai_analysis_runs.id = ai_company_analysis.run_id
where ai_analysis_runs.status = 'completed'
order by orgnr, ai_company_analysis.created_at desc;

-- Flattened feed for dashboards with optional denormalized metrics.
create or replace view ai_ops.ai_analysis_dashboard_feed as
select
    ca.run_id,
    ca.orgnr,
    ca.company_name,
    ca.summary,
    ca.recommendation,
    ca.confidence,
    ca.risk_score,
    ca.financial_grade,
    ca.commercial_grade,
    ca.operational_grade,
    ca.next_steps,
    r.model_version,
    r.started_at,
    r.completed_at
from ai_ops.ai_company_analysis ca
join ai_ops.ai_analysis_runs r on r.id = ca.run_id;

-- Optional feedback table for human-in-the-loop review.
create table if not exists ai_ops.ai_analysis_feedback (
    id bigserial primary key,
    run_id uuid references ai_ops.ai_analysis_runs(id) on delete cascade,
    orgnr text not null,
    user_id text,
    rating integer check (rating between 1 and 5),
    comment text,
    created_at timestamptz not null default now()
);

