-- Website research cohort: merged Layer-1 pool + GPT URL resolution + fetched About text + future LLM triage.
-- One screening_runs row per ingest; per-company rows keyed by (run_id, orgnr).

CREATE TABLE IF NOT EXISTS public.screening_website_research_companies (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.screening_runs(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    rank INTEGER,
    company_name TEXT,
    pool_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    gpt_official_website_url TEXT,
    gpt_url_confidence DOUBLE PRECISION,
    gpt_url_source_note TEXT,
    gpt_url_batch_index INTEGER,
    website_resolution TEXT,
    about_fetch_url_source TEXT,
    about_fetch_status TEXT NOT NULL DEFAULT 'pending',
    about_fetch_final_home_url TEXT,
    about_page_chosen_url TEXT,
    about_home_text TEXT,
    about_section_text TEXT,
    about_text_for_llm TEXT,
    about_pages_fetched INTEGER NOT NULL DEFAULT 0,
    about_fetched_at TIMESTAMPTZ,
    about_fetch_error TEXT,
    llm_triage_json JSONB,
    llm_triage_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_screening_website_research_run_orgnr UNIQUE (run_id, orgnr)
);

CREATE INDEX IF NOT EXISTS idx_screening_website_research_run
    ON public.screening_website_research_companies (run_id);

CREATE INDEX IF NOT EXISTS idx_screening_website_research_orgnr
    ON public.screening_website_research_companies (orgnr);

CREATE INDEX IF NOT EXISTS idx_screening_website_research_pending_fetch
    ON public.screening_website_research_companies (run_id)
    WHERE about_fetch_status = 'pending'
      AND gpt_official_website_url IS NOT NULL
      AND (gpt_official_website_url <> '');

COMMENT ON TABLE public.screening_website_research_companies IS
    'Per-company website research: pool snapshot, GPT-resolved URL, HTTP-fetched home/about text, optional LLM triage.';
