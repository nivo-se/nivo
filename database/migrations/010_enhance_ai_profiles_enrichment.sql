-- Migration: Add enrichment summary fields to ai_profiles
-- Adds business summary, industry keywords, and scrape timestamp metadata

ALTER TABLE IF EXISTS public.ai_profiles
    ADD COLUMN IF NOT EXISTS business_summary TEXT,
    ADD COLUMN IF NOT EXISTS industry_keywords JSONB,
    ADD COLUMN IF NOT EXISTS date_scraped TIMESTAMPTZ;


