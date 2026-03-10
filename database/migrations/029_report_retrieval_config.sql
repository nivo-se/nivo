-- Report retrieval config: admin-set limits for Deep Research web retrieval (one row).
-- Used by web_retrieval_service; visible and editable in Admin Report settings.

CREATE TABLE IF NOT EXISTS public.report_retrieval_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_queries_per_stage INTEGER NOT NULL DEFAULT 10 CHECK (max_queries_per_stage >= 4 AND max_queries_per_stage <= 20),
  max_results_per_query INTEGER NOT NULL DEFAULT 8 CHECK (max_results_per_query >= 1 AND max_results_per_query <= 20),
  max_extracted_urls INTEGER NOT NULL DEFAULT 15 CHECK (max_extracted_urls >= 8 AND max_extracted_urls <= 30),
  max_per_domain INTEGER NOT NULL DEFAULT 3 CHECK (max_per_domain >= 1 AND max_per_domain <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  CONSTRAINT one_row CHECK (id = 1)
);

INSERT INTO public.report_retrieval_config (
  id, max_queries_per_stage, max_results_per_query, max_extracted_urls, max_per_domain
)
VALUES (1, 10, 8, 15, 3)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.report_retrieval_config IS 'Admin-set retrieval limits for Deep Research (one row)';
