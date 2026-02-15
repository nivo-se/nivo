-- Performance indexes for intel/report queries and enrichment
-- Applied by scripts/bootstrap_postgres_schema.py

CREATE INDEX IF NOT EXISTS idx_company_enrichment_orgnr_kind_created
    ON public.company_enrichment(orgnr, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_created_at
    ON public.enrichment_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS financials_orgnr_year_idx
    ON public.financials(orgnr, year DESC);
