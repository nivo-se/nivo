Below is the full database-schema-spec.md you should add to /docs/database-schema-spec.md.

It is derived from the Nivo architecture and backend design: PostgreSQL as the primary system of record, agent-stage outputs for company → market → competition → strategy → value creation → projections → valuation → report, source-backed claims, interactive edits, and versioned recompute flows.  The schema is also shaped to support memo-style investment analysis with sections for company overview, market, competitive positioning, value creation, financial projections, and valuation, as demonstrated by the Bruno Mathsson reference memo.  ￼

⸻

database-schema-spec.md

Purpose

This document defines the production database schema specification for the Nivo automated company analysis platform.

The database must support:
	•	ingestion of internal company financial data
	•	agent run orchestration
	•	public-source retrieval
	•	extracted evidence and claims
	•	structured analysis outputs
	•	deterministic financial models
	•	valuation outputs
	•	report generation
	•	human edits
	•	partial recompute
	•	version history and auditability

The primary database is PostgreSQL, with pgvector enabled for semantic retrieval over evidence chunks. This matches the backend and retrieval architecture already defined for Nivo.

⸻

1. Design Principles

1.1 Postgres as source of truth

All structured business objects must be persisted in PostgreSQL.

1.2 Versioned, not overwritten

Generated outputs are append-only by version. Never destroy prior analysis states.

1.3 Evidence-first

Any claim shown in a report must be traceable to one or more stored sources.

1.4 Mixed schema strategy

Use:
	•	normalized tables for stable core entities and relations
	•	JSONB for flexible, evolving agent payload details and intermediate metadata

1.5 Recompute-aware

Schema must support partial recompute after edits to:
	•	competitors
	•	market classification
	•	assumptions
	•	model parameters

⸻

2. Extensions and Global Conventions

Required Postgres extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ID convention

Use UUID primary keys everywhere.

Timestamp convention

Use:
	•	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	•	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Soft deletion

Only use soft delete where user-facing history matters. Otherwise prefer immutable version rows + active flags.

Common columns

Most generated tables should include:
	•	id UUID PRIMARY KEY
	•	company_id UUID
	•	run_id UUID
	•	version_no INTEGER
	•	is_active BOOLEAN
	•	confidence_score NUMERIC(5,4)
	•	source_refs JSONB
	•	created_by_agent TEXT
	•	created_at
	•	updated_at

⸻

3. Core Entity Model Overview

erDiagram
    COMPANIES ||--o{ FINANCIALS : has
    COMPANIES ||--o{ RUNS : has
    COMPANIES ||--o{ COMPANY_PROFILES : has
    COMPANIES ||--o{ MARKET_ANALYSES : has
    COMPANIES ||--o{ COMPETITOR_RELATIONS : has
    COMPANIES ||--o{ STRATEGIES : has
    COMPANIES ||--o{ VALUE_CREATION_INITIATIVES : has
    COMPANIES ||--o{ FINANCIAL_MODELS : has
    COMPANIES ||--o{ VALUATIONS : has
    COMPANIES ||--o{ REPORTS : has
    COMPANIES ||--o{ CLAIMS : has
    COMPANIES ||--o{ USER_EDITS : has

    RUNS ||--o{ RUN_EVENTS : has
    RUNS ||--o{ AGENT_OUTPUTS : has
    RUNS ||--o{ RETRIEVAL_QUERIES : has
    RUNS ||--o{ EXTRACTED_FIELDS : has

    SOURCES ||--o{ SOURCE_CHUNKS : has
    SOURCES ||--o{ EXTRACTED_FIELDS : has
    SOURCES ||--o{ CLAIM_SOURCE_MAP : supports

    CLAIMS ||--o{ CLAIM_SOURCE_MAP : supported_by
    REPORTS ||--o{ REPORT_VERSIONS : has


⸻

4. Schema Groups

The schema is divided into:
	1.	company master data
	2.	internal financial data
	3.	orchestration and runs
	4.	retrieval and sources
	5.	extracted evidence
	6.	agent outputs
	7.	modeling and valuation
	8.	verification and claims
	9.	reports and versions
	10.	human edits and recompute
	11.	supporting enums and lookup tables

⸻

5. Company Master Data

5.1 companies

Stores the canonical company entity.

Columns

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_number TEXT,
    legal_name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    official_domain TEXT,
    country_code CHAR(2) DEFAULT 'SE',
    city TEXT,
    company_type TEXT,
    status TEXT,
    source_system TEXT DEFAULT 'internal',
    aliases JSONB DEFAULT '[]'::jsonb,
    identity_confidence NUMERIC(5,4),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Notes
	•	org_number should be indexed and unique when known.
	•	aliases stores discovered alternate names from retrieval.

Indexes

CREATE UNIQUE INDEX uq_companies_org_number
ON companies(org_number)
WHERE org_number IS NOT NULL;

CREATE INDEX idx_companies_normalized_name
ON companies USING gin (normalized_name gin_trgm_ops);

CREATE INDEX idx_companies_official_domain
ON companies(official_domain);


⸻

5.2 company_domains

Optional normalized domain history.

CREATE TABLE company_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    domain_type TEXT NOT NULL, -- official, suspected, historical, retailer, linkedin_like
    confidence_score NUMERIC(5,4),
    source_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

6. Internal Financial Data

6.1 financials

Stores internal historical financial statements by year.

CREATE TABLE financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'SEK',
    revenue NUMERIC(18,2),
    gross_profit NUMERIC(18,2),
    ebitda NUMERIC(18,2),
    ebit NUMERIC(18,2),
    net_income NUMERIC(18,2),
    total_assets NUMERIC(18,2),
    total_equity NUMERIC(18,2),
    net_debt NUMERIC(18,2),
    inventory NUMERIC(18,2),
    accounts_receivable NUMERIC(18,2),
    accounts_payable NUMERIC(18,2),
    capex NUMERIC(18,2),
    operating_cash_flow NUMERIC(18,2),
    free_cash_flow NUMERIC(18,2),
    employee_count INTEGER,
    data_quality_score NUMERIC(5,4),
    ingestion_batch_id TEXT,
    source_type TEXT NOT NULL DEFAULT 'internal_import',
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, fiscal_year)
);

Notes

This is the starting point of the Nivo workflow, which begins from internal financial data before web enrichment.

⸻

6.2 financial_ratios

Optional materialized helper table.

CREATE TABLE financial_ratios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    revenue_growth_pct NUMERIC(9,4),
    gross_margin_pct NUMERIC(9,4),
    ebitda_margin_pct NUMERIC(9,4),
    ebit_margin_pct NUMERIC(9,4),
    net_margin_pct NUMERIC(9,4),
    capex_pct_revenue NUMERIC(9,4),
    working_capital_pct_revenue NUMERIC(9,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, fiscal_year)
);


⸻

7. Orchestration and Run Lifecycle

7.1 runs

Tracks every analysis run.

CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_run_id UUID REFERENCES runs(id),
    triggered_by_user_id UUID,
    run_type TEXT NOT NULL, -- full, partial_recompute, manual_refresh, test
    scope JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL, -- PENDING, PLANNED, RUNNING, PARTIAL_SUCCESS, FAILED, SUCCEEDED, CANCELLED
    planner_version TEXT,
    graph_version TEXT,
    llm_policy_version TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Indexes

CREATE INDEX idx_runs_company_created
ON runs(company_id, created_at DESC);

CREATE INDEX idx_runs_status
ON runs(status);


⸻

7.2 run_events

Detailed audit trail for stages and status changes.

CREATE TABLE run_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- stage_started, stage_completed, retry, warning, failure, user_override
    stage_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

7.3 agent_outputs

Stores raw structured outputs from each node before they are promoted into domain tables.

CREATE TABLE agent_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    output_version INTEGER NOT NULL,
    status TEXT NOT NULL, -- success, partial, failed
    payload JSONB NOT NULL,
    confidence_score NUMERIC(5,4),
    source_refs JSONB DEFAULT '[]'::jsonb,
    model_name TEXT,
    prompt_version TEXT,
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(run_id, stage_name, output_version)
);

Why keep this

Useful for:
	•	debugging
	•	regression testing
	•	prompt iteration
	•	comparing pre-normalized vs normalized output

⸻

8. Retrieval and Source Storage

8.1 retrieval_queries

CREATE TABLE retrieval_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    query_text TEXT NOT NULL,
    normalized_query_key TEXT NOT NULL,
    query_type TEXT NOT NULL, -- identity, discovery, verification, fallback
    locale TEXT,
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    provider TEXT NOT NULL, -- serpapi, direct, etc
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Indexes

CREATE INDEX idx_retrieval_queries_company_stage
ON retrieval_queries(company_id, stage_name, created_at DESC);

CREATE INDEX idx_retrieval_queries_normkey
ON retrieval_queries(normalized_query_key);


⸻

8.2 retrieval_results

CREATE TABLE retrieval_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retrieval_query_id UUID NOT NULL REFERENCES retrieval_queries(id) ON DELETE CASCADE,
    rank_position INTEGER,
    title TEXT,
    url TEXT NOT NULL,
    domain TEXT,
    snippet TEXT,
    provider_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

8.3 sources

This is a foundational table.

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    final_url TEXT,
    domain TEXT,
    title TEXT,
    publisher TEXT,
    source_type TEXT NOT NULL, -- official_company_site, registry, annual_report, business_media, retailer, blog, etc
    content_type TEXT NOT NULL, -- html, pdf, image, json
    language_code TEXT,
    published_date DATE,
    fetched_at TIMESTAMPTZ,
    http_status INTEGER,
    content_hash TEXT,
    object_storage_path TEXT,
    rendered_object_path TEXT,
    extraction_quality_score NUMERIC(5,4),
    relevance_score NUMERIC(5,4),
    recency_score NUMERIC(5,4),
    source_type_score NUMERIC(5,4),
    composite_score NUMERIC(5,4),
    robots_note TEXT,
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Indexes

CREATE INDEX idx_sources_company
ON sources(company_id);

CREATE INDEX idx_sources_domain_published
ON sources(domain, published_date DESC);

CREATE INDEX idx_sources_composite
ON sources(composite_score DESC);


⸻

8.4 source_chunks

Used for retrieval, semantic evidence support, and verification.

CREATE TABLE source_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    page_number INTEGER,
    section_title TEXT,
    chunk_order INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    token_count INTEGER,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Indexes

CREATE INDEX idx_source_chunks_source
ON source_chunks(source_id, chunk_order);

-- example ivfflat index, adjust lists later
CREATE INDEX idx_source_chunks_embedding
ON source_chunks
USING ivfflat (embedding vector_cosine_ops);


⸻

9. Extracted Evidence

9.1 extracted_fields

Stores field-level extracted facts from sources.

CREATE TABLE extracted_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    stage_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    value_json JSONB NOT NULL,
    support_span TEXT,
    extraction_method TEXT NOT NULL, -- regex, rule_based, llm_fallback, table_parse
    confidence_score NUMERIC(5,4),
    conflict_flag BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

9.2 field_candidates

Optional canonicalization layer when multiple extracted values compete.

CREATE TABLE field_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    stage_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    candidate_value JSONB NOT NULL,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    confidence_score NUMERIC(5,4),
    candidate_status TEXT NOT NULL, -- accepted, rejected, conflicting, pending
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

10. Stage Output Tables

These are the normalized domain objects the UI and downstream services should consume.

⸻

10.1 company_profiles

CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    business_model TEXT,
    products JSONB DEFAULT '[]'::jsonb,
    geography JSONB DEFAULT '[]'::jsonb,
    revenue_streams JSONB DEFAULT '[]'::jsonb,
    ownership TEXT,
    founding_year INTEGER,
    history TEXT,
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, run_id, version_no)
);

This directly mirrors the company profiling stage in the original Nivo workflow.

⸻

10.2 market_analyses

CREATE TABLE market_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    industry_label TEXT,
    niche_label TEXT,
    market_size_value NUMERIC(18,2),
    market_size_currency CHAR(3),
    market_size_unit TEXT, -- msek, bsek, musd, etc
    market_growth_low NUMERIC(9,4),
    market_growth_high NUMERIC(9,4),
    market_segments JSONB DEFAULT '[]'::jsonb,
    structural_trends JSONB DEFAULT '[]'::jsonb,
    digital_opportunities JSONB DEFAULT '[]'::jsonb,
    customer_segments JSONB DEFAULT '[]'::jsonb,
    justification TEXT,
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

10.3 competitor_relations

This table stores the subject company’s competitor set.

CREATE TABLE competitor_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    competitor_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    competitor_name TEXT NOT NULL,
    comparable_type TEXT NOT NULL, -- operating, positioning, adjacent
    similarity_score NUMERIC(5,4),
    product_overlap_score NUMERIC(5,4),
    price_point_score NUMERIC(5,4),
    geography_overlap_score NUMERIC(5,4),
    business_model_score NUMERIC(5,4),
    include_rationale TEXT,
    exclude_flag BOOLEAN NOT NULL DEFAULT false,
    source_refs JSONB DEFAULT '[]'::jsonb,
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Notes

Nivo’s source design makes editable competitor lists central to the platform, so competitor relations must be versioned and support manual overrides.

⸻

10.4 competitor_profiles

CREATE TABLE competitor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_relation_id UUID NOT NULL REFERENCES competitor_relations(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    description TEXT,
    geography JSONB DEFAULT '[]'::jsonb,
    positioning TEXT,
    business_model TEXT,
    revenue_estimate_low NUMERIC(18,2),
    revenue_estimate_high NUMERIC(18,2),
    revenue_currency CHAR(3),
    ebitda_margin_low NUMERIC(9,4),
    ebitda_margin_high NUMERIC(9,4),
    export_share_low NUMERIC(9,4),
    export_share_high NUMERIC(9,4),
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

10.5 strategies

CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    opportunities JSONB DEFAULT '[]'::jsonb,
    threats JSONB DEFAULT '[]'::jsonb,
    moat_analysis JSONB DEFAULT '[]'::jsonb,
    strategic_summary TEXT,
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

10.6 value_creation_initiatives

This should reflect Nivo’s five-pillar value creation approach: revenue acceleration, operational efficiency, balance-sheet optimization, digitalization, and people/organization.

CREATE TABLE value_creation_initiatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    initiative_order INTEGER,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- revenue, operations, balance_sheet, digital, people
    description TEXT,
    driver_type TEXT,
    required_capabilities JSONB DEFAULT '[]'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    time_to_impact_months INTEGER,
    capital_need_level TEXT, -- low, medium, high
    risk_level TEXT, -- low, medium, high
    impact_estimate_json JSONB,
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

11. Modeling and Valuation

11.1 model_assumptions

Separates assumptions from computed outputs.

CREATE TABLE model_assumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    scenario_name TEXT NOT NULL, -- base, upside, downside
    assumption_key TEXT NOT NULL,
    assumption_value_json JSONB NOT NULL,
    rationale TEXT,
    bound_type TEXT, -- history_bound, peer_bound, market_bound, manual_override
    lower_bound NUMERIC(18,6),
    upper_bound NUMERIC(18,6),
    human_adjustable BOOLEAN NOT NULL DEFAULT true,
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

11.2 financial_models

Stores metadata per model version.

CREATE TABLE financial_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    projection_horizon_years INTEGER NOT NULL DEFAULT 7,
    base_year INTEGER NOT NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

11.3 financial_model_lines

Stores the actual projected lines by year and scenario.

CREATE TABLE financial_model_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_model_id UUID NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
    scenario_name TEXT NOT NULL, -- base, upside, downside
    fiscal_year INTEGER NOT NULL,
    revenue NUMERIC(18,2),
    gross_profit NUMERIC(18,2),
    ebitda NUMERIC(18,2),
    ebit NUMERIC(18,2),
    capex NUMERIC(18,2),
    change_in_working_capital NUMERIC(18,2),
    operating_cash_flow NUMERIC(18,2),
    free_cash_flow NUMERIC(18,2),
    gross_margin_pct NUMERIC(9,4),
    ebitda_margin_pct NUMERIC(9,4),
    wc_pct_revenue NUMERIC(9,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(financial_model_id, scenario_name, fiscal_year)
);

The original architecture explicitly calls for 7-year projections with assumption commentary and source support.

⸻

11.4 valuations

CREATE TABLE valuations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    methodology TEXT NOT NULL, -- ebitda_multiple, peer_range, blended
    base_scenario TEXT NOT NULL DEFAULT 'base',
    ev_low NUMERIC(18,2),
    ev_high NUMERIC(18,2),
    equity_value_low NUMERIC(18,2),
    equity_value_high NUMERIC(18,2),
    multiple_low NUMERIC(9,4),
    multiple_high NUMERIC(9,4),
    uncertainty_note TEXT,
    peer_quality_score NUMERIC(5,4),
    source_refs JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5,4),
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

11.5 valuation_peers

CREATE TABLE valuation_peers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_id UUID NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
    competitor_relation_id UUID REFERENCES competitor_relations(id) ON DELETE SET NULL,
    peer_name TEXT NOT NULL,
    metric_label TEXT NOT NULL, -- ntm_ebitda, ltm_ebitda, revenue_multiple
    metric_value NUMERIC(12,4),
    include_flag BOOLEAN NOT NULL DEFAULT true,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

11.6 valuation_sensitivities

CREATE TABLE valuation_sensitivities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_id UUID NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
    scenario_name TEXT NOT NULL,
    x_label TEXT NOT NULL,
    y_label TEXT NOT NULL,
    matrix_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

12. Claims and Verification

12.1 claims

Core table for anti-hallucination control.

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    subject_type TEXT NOT NULL, -- company, market, competitor, strategy, initiative, projection, valuation, report
    subject_id UUID,
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL, -- numeric, qualitative, categorical, benchmark
    verification_status TEXT NOT NULL, -- supported, unsupported, uncertain, conflicting
    confidence_score NUMERIC(5,4),
    criticality TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Indexes

CREATE INDEX idx_claims_company_status
ON claims(company_id, verification_status);

CREATE INDEX idx_claims_stage
ON claims(stage_name);


⸻

12.2 claim_source_map

Many-to-many join between claims and supporting sources.

CREATE TABLE claim_source_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL,
    support_span TEXT,
    support_strength NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

Why this matters

Nivo’s core philosophy is that claims must have sources, and the verification layer should block unsupported output from reaching the report.

⸻

12.3 verification_runs

CREATE TABLE verification_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    verification_version TEXT NOT NULL,
    supported_count INTEGER NOT NULL DEFAULT 0,
    unsupported_count INTEGER NOT NULL DEFAULT 0,
    uncertain_count INTEGER NOT NULL DEFAULT 0,
    conflicting_count INTEGER NOT NULL DEFAULT 0,
    blocking_flag BOOLEAN NOT NULL DEFAULT false,
    summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

13. Report Storage

13.1 reports

Logical report entity.

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    current_version_id UUID,
    report_type TEXT NOT NULL DEFAULT 'investment_analysis',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

13.2 report_versions

CREATE TABLE report_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    status TEXT NOT NULL, -- draft, verified_draft, analyst_reviewed, approved, archived
    report_json JSONB NOT NULL,
    summary_text TEXT,
    source_ref_count INTEGER,
    unsupported_claim_count INTEGER,
    created_by_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(report_id, version_no)
);

Notes

Report JSON should align with the memo-style section structure used in Nivo and reflected in the Bruno Mathsson example: executive summary, company, market, competition, value creation, financials, valuation.

⸻

13.3 report_blocks

Optional if you want normalized block-level rendering and diffing.

CREATE TABLE report_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_version_id UUID NOT NULL REFERENCES report_versions(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    block_order INTEGER NOT NULL,
    block_type TEXT NOT NULL, -- paragraph, bullet_list, chart, table, callout
    title TEXT,
    body_json JSONB NOT NULL,
    claim_refs JSONB DEFAULT '[]'::jsonb,
    source_refs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

14. Human-in-the-Loop and Edits

14.1 user_edits

Tracks all analyst changes.

CREATE TABLE user_edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    report_version_id UUID REFERENCES report_versions(id) ON DELETE SET NULL,
    user_id UUID,
    edit_type TEXT NOT NULL, -- competitor_add, competitor_remove, assumption_override, market_override, narrative_note
    target_type TEXT NOT NULL,
    target_id UUID,
    previous_value JSONB,
    new_value JSONB,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

14.2 recompute_requests

CREATE TABLE recompute_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    triggered_by_edit_id UUID REFERENCES user_edits(id) ON DELETE SET NULL,
    requested_by_user_id UUID,
    affected_stages JSONB NOT NULL,
    status TEXT NOT NULL, -- pending, running, done, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

Why needed

Supports partial recompute after competitor edits or assumption overrides, which is a core requirement in the Nivo design.  ￼

⸻

15. Optional Supporting Tables

15.1 users

If auth is local/custom.

15.2 analysis_templates

For reusable report or scoring templates.

15.3 benchmark_sets

Pre-computed sector benchmark libraries.

15.4 llm_call_logs

Useful for cost/performance auditing.

CREATE TABLE llm_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    stage_name TEXT,
    model_name TEXT,
    prompt_version TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


⸻

16. Enums vs Text Columns

Recommendation

Use TEXT + app-level enums initially, with check constraints only for the most critical fields.

This gives flexibility early while avoiding migration churn.

Add DB-level constraints for
	•	runs.status
	•	claims.verification_status
	•	value_creation_initiatives.category
	•	report_versions.status

Example:

ALTER TABLE runs
ADD CONSTRAINT chk_runs_status
CHECK (status IN ('PENDING','PLANNED','RUNNING','PARTIAL_SUCCESS','FAILED','SUCCEEDED','CANCELLED'));


⸻

17. JSONB vs Normalized Tables Decision Rules

Use normalized tables when
	•	the entity is queried frequently
	•	relationships matter
	•	versioning matters
	•	filtering/sorting is important

Use JSONB when
	•	schema is evolving
	•	payload is agent-specific
	•	UI consumes it mostly as a blob
	•	the object is secondary metadata

Recommended split

Normalize
	•	companies
	•	runs
	•	sources
	•	claims
	•	competitors
	•	financial models
	•	valuations
	•	reports

JSONB-friendly
	•	raw agent payloads
	•	source refs lists
	•	report block bodies
	•	model assumption detail payloads
	•	extraction metadata

⸻

18. Index Strategy

Must-have indexes

CREATE INDEX idx_company_profiles_active
ON company_profiles(company_id, is_active, created_at DESC);

CREATE INDEX idx_market_analyses_active
ON market_analyses(company_id, is_active, created_at DESC);

CREATE INDEX idx_competitor_relations_company_similarity
ON competitor_relations(company_id, similarity_score DESC);

CREATE INDEX idx_value_creation_company_category
ON value_creation_initiatives(company_id, category);

CREATE INDEX idx_financial_models_company_active
ON financial_models(company_id, is_active, created_at DESC);

CREATE INDEX idx_valuations_company_active
ON valuations(company_id, is_active, created_at DESC);

CREATE INDEX idx_report_versions_report_version
ON report_versions(report_id, version_no DESC);

CREATE INDEX idx_user_edits_company_created
ON user_edits(company_id, created_at DESC);

JSONB indexes where useful

CREATE INDEX idx_reports_json_gin
ON report_versions USING gin (report_json);

CREATE INDEX idx_agent_outputs_payload_gin
ON agent_outputs USING gin (payload);


⸻

19. Versioning Rules

Rule 1

Never update prior semantic outputs in place.

Rule 2

When a recompute occurs:
	•	create a new run
	•	create new stage version rows
	•	set prior row is_active = false
	•	set latest row is_active = true

Rule 3

Reports point to a version, not mutable content.

Rule 4

User edits never overwrite system output; they create override records.

⸻

20. Example Retrieval-to-Claim Flow
	1.	retrieval_queries stores "Bruno Mathsson competitors"
	2.	retrieval_results stores URLs returned
	3.	sources stores fetched pages and metadata
	4.	source_chunks stores extracted text chunks
	5.	extracted_fields stores field candidates like positioning = "design heritage premium"
	6.	competitor_relations stores selected peers
	7.	claims stores "Company operates in premium design heritage segment"
	8.	claim_source_map links claim to chunks and support spans
	9.	report_versions includes the supported narrative only

That flow is exactly what Nivo needs to avoid unsupported synthesis while still producing memo-like reports.

⸻

21. Minimal MVP Table Set

If you want the smallest useful first implementation, start with:
	•	companies
	•	financials
	•	runs
	•	run_events
	•	sources
	•	source_chunks
	•	claims
	•	claim_source_map
	•	company_profiles
	•	market_analyses
	•	competitor_relations
	•	competitor_profiles
	•	strategies
	•	value_creation_initiatives
	•	model_assumptions
	•	financial_models
	•	financial_model_lines
	•	valuations
	•	reports
	•	report_versions
	•	user_edits

Everything else can be added incrementally.

⸻

22. Migration Order

Create tables in this order:
	1.	extensions
	2.	companies
	3.	financials
	4.	runs / run_events
	5.	retrieval tables
	6.	sources / source_chunks
	7.	extracted fields
	8.	stage output tables
	9.	modeling tables
	10.	claims / verification tables
	11.	reports
	12.	user edits / recompute tables
	13.	indexes
	14.	constraints

This order reduces foreign-key friction.

⸻

23. Definition of Done

The schema spec is successfully implemented when:
	•	migrations apply cleanly
	•	one company can be ingested
	•	one run can execute and persist outputs by stage
	•	one report version can be created from verified claims
	•	competitor edits can trigger recompute requests
	•	all report-visible claims are source-traceable

That level of schema completeness is necessary for Nivo’s goal of scalable, evidence-backed, semi-automated investment analysis.

⸻

