-- Migration: Views, Lists, Labels for Universe/Pipeline collaboration
-- Universe = Saved Views (dynamic filters); Pipeline = Lists (static snapshots); Labels = human judgement
-- Replaces saved_company_lists with normalized saved_lists + saved_list_items

-- 1. SAVED_VIEWS (dynamic filter config)
CREATE TABLE IF NOT EXISTS public.saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('private', 'team')),
    filters_json JSONB NOT NULL DEFAULT '{}',
    columns_json JSONB NOT NULL DEFAULT '[]',
    sort_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON public.saved_views(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_scope ON public.saved_views(scope);

-- 2. SAVED_LISTS (static snapshots, optionally from a view)
CREATE TABLE IF NOT EXISTS public.saved_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('private', 'team')),
    source_view_id UUID REFERENCES public.saved_views(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_lists_owner ON public.saved_lists(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_lists_scope ON public.saved_lists(scope);

-- 3. SAVED_LIST_ITEMS (normalized list membership)
CREATE TABLE IF NOT EXISTS public.saved_list_items (
    list_id UUID NOT NULL REFERENCES public.saved_lists(id) ON DELETE CASCADE,
    orgnr TEXT NOT NULL,
    added_by_user_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, orgnr)
);

CREATE INDEX IF NOT EXISTS idx_saved_list_items_orgnr ON public.saved_list_items(orgnr);

-- 4. COMPANY_LABELS (human judgement per company)
-- Team scope: one label per (orgnr, label, scope); private: per user
CREATE TABLE IF NOT EXISTS public.company_labels (
    orgnr TEXT NOT NULL,
    label TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('private', 'team')),
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (orgnr, label, scope, created_by_user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_labels_orgnr ON public.company_labels(orgnr);
CREATE INDEX IF NOT EXISTS idx_company_labels_label ON public.company_labels(label);

-- Trigger: updated_at for saved_views
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saved_views_updated ON public.saved_views;
CREATE TRIGGER trg_saved_views_updated
    BEFORE UPDATE ON public.saved_views
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_saved_lists_updated ON public.saved_lists;
CREATE TRIGGER trg_saved_lists_updated
    BEFORE UPDATE ON public.saved_lists
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.saved_views IS 'Dynamic filter configs for Universe; scope private|team';
COMMENT ON TABLE public.saved_lists IS 'Static company lists for Pipeline; scope private|team';
COMMENT ON TABLE public.saved_list_items IS 'List membership with add audit';
COMMENT ON TABLE public.company_labels IS 'Human labels (e.g. Hot, Pass) per company; scope private|team';
