-- Add first_name and last_name to user_roles for user display names
-- Idempotent: safe to run multiple times
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN first_name TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN last_name TEXT;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- user_roles may not exist in this project
END $$;
