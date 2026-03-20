-- Company identity layer + Prospects ↔ CRM link
-- Depends on: 024_deep_research_persistence, 026_crm_foundation
-- Purpose: Unify public.companies (orgnr) and deep_research.companies (UUID) for consistent company access.

-- 1) Company identity view: orgnr as the canonical bridge
-- Use LEFT JOINs so we get all rows from both sides; orgnr is the key.
CREATE OR REPLACE VIEW public.company_identity AS
SELECT
  COALESCE(p.orgnr, dr.orgnr) AS orgnr,
  p.company_name AS public_name,
  p.homepage AS public_homepage,
  dr.id AS deep_research_company_id,
  dr.name AS deep_research_name,
  dr.website AS deep_research_website,
  dr.industry AS deep_research_industry,
  CASE
    WHEN p.orgnr IS NOT NULL AND dr.id IS NOT NULL THEN 'both'
    WHEN p.orgnr IS NOT NULL THEN 'public_only'
    WHEN dr.id IS NOT NULL THEN 'deep_research_only'
    ELSE 'unknown'
  END AS identity_source
FROM public.companies p
FULL OUTER JOIN deep_research.companies dr ON p.orgnr = dr.orgnr
WHERE COALESCE(p.orgnr, dr.orgnr) IS NOT NULL
  AND (dr.orgnr IS NULL OR NOT dr.orgnr LIKE 'tmp-%');

COMMENT ON VIEW public.company_identity IS 'Unified company identity: orgnr bridges public.companies and deep_research.companies. Use orgnr for lookups.';

-- 2) Ensure prospects table exists (may be created by API on first use)
-- Use same structure as backend/api/prospects.py _ensure_tables
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  owner_user_id text NOT NULL,
  scope text NOT NULL DEFAULT 'team',
  status text NOT NULL DEFAULT 'new',
  owner text,
  last_contact timestamptz,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, owner_user_id, scope)
);

CREATE TABLE IF NOT EXISTS public.prospect_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  author text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Add deep_research_company_id to prospects (nullable FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prospects' AND column_name = 'deep_research_company_id'
  ) THEN
    ALTER TABLE public.prospects
    ADD COLUMN deep_research_company_id uuid REFERENCES deep_research.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_prospects_deep_research_company_id
  ON public.prospects(deep_research_company_id)
  WHERE deep_research_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_prospects_company_id
  ON public.prospects(company_id);

-- 4) Backfill prospects.deep_research_company_id from orgnr match
UPDATE public.prospects p
SET deep_research_company_id = dr.id
FROM deep_research.companies dr
WHERE p.company_id = dr.orgnr
  AND p.deep_research_company_id IS NULL
  AND NOT dr.orgnr LIKE 'tmp-%';

-- 5) Helper function: resolve orgnr -> deep_research company id
CREATE OR REPLACE FUNCTION public.resolve_deep_research_company_id(p_orgnr text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM deep_research.companies WHERE orgnr = p_orgnr AND orgnr NOT LIKE 'tmp-%' LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_deep_research_company_id IS 'Resolve orgnr to deep_research.companies.id. Returns NULL if not found.';

-- 6) Helper function: resolve deep_research id -> orgnr
CREATE OR REPLACE FUNCTION public.resolve_orgnr_from_deep_research(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT orgnr FROM deep_research.companies WHERE id = p_company_id LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_orgnr_from_deep_research IS 'Resolve deep_research.companies.id to orgnr. Returns NULL if not found.';

-- 7) Trigger: keep prospects.deep_research_company_id in sync when company_id (orgnr) changes
CREATE OR REPLACE FUNCTION public.prospects_sync_deep_research_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND (NEW.company_id != COALESCE(OLD.company_id, '') OR OLD.company_id IS NULL) THEN
    NEW.deep_research_company_id := public.resolve_deep_research_company_id(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospects_sync_deep_research ON public.prospects;
CREATE TRIGGER trg_prospects_sync_deep_research
  BEFORE INSERT OR UPDATE OF company_id ON public.prospects
  FOR EACH ROW
  EXECUTE PROCEDURE public.prospects_sync_deep_research_company_id();
