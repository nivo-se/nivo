-- Deep Research V2: report_spec, evidence_bundles, assumption_registries
-- Per docs/deep_research/tightning/ Phase 1

-- 1) report_specs — machine-readable contract per run
CREATE TABLE IF NOT EXISTS deep_research.report_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    report_id UUID NOT NULL,
    run_mode TEXT NOT NULL DEFAULT 'standard_deep_research',
    spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_versions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_report_specs_run UNIQUE (run_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_report_specs_run ON deep_research.report_specs(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_report_specs_company ON deep_research.report_specs(company_id);

-- 2) evidence_bundles — validated evidence per run
CREATE TABLE IF NOT EXISTS deep_research.evidence_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    bundle_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    coverage_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_evidence_bundles_run UNIQUE (run_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_evidence_bundles_run ON deep_research.evidence_bundles(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_evidence_bundles_company ON deep_research.evidence_bundles(company_id);

-- 3) assumption_registries — valuation-grade assumptions per run
CREATE TABLE IF NOT EXISTS deep_research.assumption_registries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES deep_research.companies(id) ON DELETE SET NULL,
    registry_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    completeness_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    readiness_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    valuation_ready BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dr_assumption_registries_run UNIQUE (run_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_assumption_registries_run ON deep_research.assumption_registries(run_id);
CREATE INDEX IF NOT EXISTS ix_dr_assumption_registries_company ON deep_research.assumption_registries(company_id);
