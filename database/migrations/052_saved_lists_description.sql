-- Optional human-readable summary for lists (e.g. sourcing “why this list”)
ALTER TABLE public.saved_lists ADD COLUMN IF NOT EXISTS description TEXT;
COMMENT ON COLUMN public.saved_lists.description IS 'Plain-language filter/sourcing summary; not shown in table UI by default';
