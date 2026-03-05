-- Extend saved_lists.scope to allow 'public' (private | team | public)
ALTER TABLE public.saved_lists DROP CONSTRAINT IF EXISTS saved_lists_scope_check;
ALTER TABLE public.saved_lists ADD CONSTRAINT saved_lists_scope_check CHECK (scope IN ('private', 'team', 'public'));
COMMENT ON COLUMN public.saved_lists.scope IS 'Visibility: private (owner only), team (shared), or public';
