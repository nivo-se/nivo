-- Add stage to saved_lists: research | ai_analysis | prospects
ALTER TABLE public.saved_lists
ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'research'
  CHECK (stage IN ('research', 'ai_analysis', 'prospects'));

COMMENT ON COLUMN public.saved_lists.stage IS 'Pipeline stage: research, ai_analysis, or prospects';
