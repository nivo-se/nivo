-- Sector multiple reference: EV/EBITDA sanity ranges per sector (VALUATION_INTELLIGENCE_SPEC).
-- Used by valuation engine for sanity checks and sector-specific ranges.

CREATE TABLE IF NOT EXISTS public.sector_multiple_reference (
  id SERIAL PRIMARY KEY,
  sector TEXT NOT NULL UNIQUE,
  ev_ebitda_low NUMERIC(6,2) NOT NULL CHECK (ev_ebitda_low >= 0),
  ev_ebitda_high NUMERIC(6,2) NOT NULL CHECK (ev_ebitda_high >= ev_ebitda_low),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sector_multiple_reference_sector ON public.sector_multiple_reference(sector);

INSERT INTO public.sector_multiple_reference (sector, ev_ebitda_low, ev_ebitda_high)
VALUES
  ('Industrial', 5, 7),
  ('Consumer', 5, 8),
  ('Furniture/design', 5, 7),
  ('SaaS', 8, 15),
  ('Services', 4, 7),
  ('General', 4.1, 8.0)
ON CONFLICT (sector) DO UPDATE SET
  ev_ebitda_low = EXCLUDED.ev_ebitda_low,
  ev_ebitda_high = EXCLUDED.ev_ebitda_high,
  updated_at = NOW();

COMMENT ON TABLE public.sector_multiple_reference IS 'EV/EBITDA sanity ranges per sector for valuation validation';
