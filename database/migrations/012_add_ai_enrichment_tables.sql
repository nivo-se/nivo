-- Step 4: AI enrichment tables for V2 import + run history
-- enrichment_runs: run metadata
-- company_enrichment: per-company enrichment results by kind

DROP TABLE IF EXISTS public.company_enrichment CASCADE;
DROP TABLE IF EXISTS public.enrichment_runs CASCADE;

CREATE TABLE public.enrichment_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT,
    model TEXT,
    provider TEXT,
    prompt_version TEXT,
    meta JSONB
);

CREATE TABLE public.company_enrichment (
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
