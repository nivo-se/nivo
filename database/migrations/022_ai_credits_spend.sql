-- AI credits: admin-set spend limits and per-user usage tracking
-- Run this on Supabase (and/or local Postgres) for AI spend controls.

-- Single-row config: global and per-user monthly limits (USD)
CREATE TABLE IF NOT EXISTS public.ai_credits_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  global_monthly_limit_usd NUMERIC(12,4) NOT NULL DEFAULT 100,
  per_user_monthly_limit_usd NUMERIC(12,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  CONSTRAINT one_row CHECK (id = 1)
);

INSERT INTO public.ai_credits_config (id, global_monthly_limit_usd, per_user_monthly_limit_usd)
VALUES (1, 100, 50)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.ai_credits_config IS 'Admin-set spend limits for AI credits (one row)';
COMMENT ON COLUMN public.ai_credits_config.per_user_monthly_limit_usd IS 'Null means no per-user cap (only global applies)';

-- Per-event usage: one row per AI operation (screening run, deep analysis run, ai_filter call)
CREATE TABLE IF NOT EXISTS public.ai_credits_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount_usd NUMERIC(12,6) NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('screening', 'deep_analysis', 'ai_filter')),
  run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_usage_user_created
  ON public.ai_credits_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credits_usage_created
  ON public.ai_credits_usage(created_at DESC);

COMMENT ON TABLE public.ai_credits_usage IS 'Tracks each user AI spend for limits and admin reporting';
