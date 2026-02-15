-- Migration: Add acquisition angle field to ai_profiles

ALTER TABLE IF EXISTS public.ai_profiles
    ADD COLUMN IF NOT EXISTS acquisition_angle TEXT;


