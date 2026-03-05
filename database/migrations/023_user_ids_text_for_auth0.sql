-- Auth0 uses opaque sub strings (e.g. auth0|xxx), not UUIDs.
-- Change user ID columns from UUID to TEXT so we can store Auth0 subs.

-- saved_lists.owner_user_id
ALTER TABLE public.saved_lists
  ALTER COLUMN owner_user_id TYPE TEXT USING owner_user_id::text;

-- saved_views.owner_user_id
ALTER TABLE public.saved_views
  ALTER COLUMN owner_user_id TYPE TEXT USING owner_user_id::text;

-- saved_list_items.added_by_user_id
ALTER TABLE public.saved_list_items
  ALTER COLUMN added_by_user_id TYPE TEXT USING added_by_user_id::text;

-- company_labels: PK includes created_by_user_id; must drop and recreate
ALTER TABLE public.company_labels DROP CONSTRAINT IF EXISTS company_labels_pkey;
ALTER TABLE public.company_labels
  ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::text;
ALTER TABLE public.company_labels
  ADD PRIMARY KEY (orgnr, label, scope, created_by_user_id);

-- prospects (if table exists - created by prospects API)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prospects') THEN
    ALTER TABLE public.prospects ALTER COLUMN owner_user_id TYPE TEXT USING owner_user_id::text;
  END IF;
END $$;
