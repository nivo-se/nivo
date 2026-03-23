-- Ensure SNI/NACE codes exist for universe / screening industry filters (Allabolag-style JSON array).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS nace_codes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.companies.nace_codes IS 'SNI/NACE industry codes as JSON array of strings (e.g. ["49410","64110"])';
