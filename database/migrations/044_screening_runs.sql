-- Screening pipeline runs: manifest-based Layer 1 / Layer 2 / controlled pipeline persistence.
-- See docs/screening_runs_db_proposal.md

CREATE TABLE IF NOT EXISTS public.screening_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_kind TEXT NOT NULL,
    parent_run_id UUID REFERENCES public.screening_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    git_commit TEXT,
    script_name TEXT,
    script_version TEXT,
    config_path TEXT,
    config_hash_sha256 TEXT,
    top_n INTEGER,
    status TEXT,
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    manifest_json JSONB,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_screening_runs_kind_created
    ON public.screening_runs (run_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screening_runs_git_commit
    ON public.screening_runs (git_commit);

COMMENT ON TABLE public.screening_runs IS
    'One row per screening batch run (Layer 1, Layer 2, or controlled pipeline); manifests in manifest_json/settings_json.';

CREATE TABLE IF NOT EXISTS public.screening_run_companies (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.screening_runs(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    company_name TEXT,
    rank INTEGER,
    layer1_total_score DOUBLE PRECISION,
    layer1_base_similarity_score DOUBLE PRECISION,
    layer1_product_signal BOOLEAN,
    layer1_exclusion_flags TEXT,
    layer2_is_fit_for_nivo BOOLEAN,
    layer2_fit_confidence DOUBLE PRECISION,
    layer2_blended_score DOUBLE PRECISION,
    layer2_classification_json JSONB,
    layer2_error TEXT,
    raw_row_json JSONB,
    source_artifacts_json JSONB,
    CONSTRAINT uq_screening_run_companies_run_orgnr UNIQUE (run_id, orgnr)
);

CREATE INDEX IF NOT EXISTS idx_screening_run_companies_run
    ON public.screening_run_companies (run_id);
CREATE INDEX IF NOT EXISTS idx_screening_run_companies_orgnr
    ON public.screening_run_companies (orgnr);

COMMENT ON TABLE public.screening_run_companies IS
    'Per-company outputs for a screening run (Layer 1 ranks/scores + optional Layer 2 classification).';
