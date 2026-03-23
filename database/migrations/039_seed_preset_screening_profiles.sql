-- Seed five team-scoped Layer 1 screening profiles (preset library).
-- Idempotent: fixed UUIDs; skips rows that already exist.
-- Owner matches local dev bypass user; scope=team so all users see them in /api/screening/profiles?scope=all

-- 1) Growth & momentum — favors CAGR, scale, strategic fit
INSERT INTO public.screening_profiles (id, name, description, owner_user_id, scope)
SELECT
  'f1000001-0000-4000-8000-000000000001'::uuid,
  'Growth & momentum (preset)',
  'Prioritizes revenue growth, scale, and fit. Excludes very weak margins or deep negative CAGR.',
  '00000000-0000-0000-0000-000000000001',
  'team'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profiles WHERE id = 'f1000001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.screening_profile_versions (id, profile_id, version, config_json, is_active, created_by_user_id)
SELECT
  'f2000001-0000-4000-8000-000000000001'::uuid,
  'f1000001-0000-4000-8000-000000000001'::uuid,
  1,
  $$
  {
    "variables": [
      {"id": "growth", "source": "revenue_cagr_3y", "normalize": "min_max", "range": [-0.05, 0.30]},
      {"id": "scale", "source": "revenue_latest", "normalize": "min_max", "range": [20000000, 800000000]},
      {"id": "fit", "source": "fit_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "ops", "source": "ops_upside_score", "normalize": "min_max", "range": [0, 100]}
    ],
    "weights": {"growth": 0.35, "scale": 0.25, "fit": 0.25, "ops": 0.15},
    "archetypes": [
      {"code": "high_growth", "criteria": {"revenue_cagr_3y": {"gte": 0.10}, "revenue_latest": {"gte": 50000000}}},
      {"code": "scaling", "criteria": {"revenue_latest": {"gte": 100000000}, "ebitda_margin_latest": {"gte": 0.06}}}
    ],
    "exclusion_rules": [
      {"field": "ebitda_margin_latest", "op": "<=", "value": 0.03},
      {"field": "revenue_cagr_3y", "op": "<=", "value": -0.08}
    ]
  }
  $$::jsonb,
  true,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profile_versions WHERE id = 'f2000001-0000-4000-8000-000000000001'::uuid);

-- 2) Quality & profitability — margins and Nivo total score
INSERT INTO public.screening_profiles (id, name, description, owner_user_id, scope)
SELECT
  'f1000001-0000-4000-8000-000000000002'::uuid,
  'Quality & profitability (preset)',
  'Emphasizes EBITDA margin, overall Nivo score, and data quality. Screens out very small revenue.',
  '00000000-0000-0000-0000-000000000001',
  'team'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profiles WHERE id = 'f1000001-0000-4000-8000-000000000002'::uuid);

INSERT INTO public.screening_profile_versions (id, profile_id, version, config_json, is_active, created_by_user_id)
SELECT
  'f2000001-0000-4000-8000-000000000002'::uuid,
  'f1000001-0000-4000-8000-000000000002'::uuid,
  1,
  $$
  {
    "variables": [
      {"id": "margin", "source": "ebitda_margin_latest", "normalize": "min_max", "range": [0, 0.35]},
      {"id": "nivo", "source": "nivo_total_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "dq", "source": "data_quality_score", "normalize": "min_max", "range": [0, 100]}
    ],
    "weights": {"margin": 0.40, "nivo": 0.40, "dq": 0.20},
    "archetypes": [
      {"code": "quality_leader", "criteria": {"ebitda_margin_latest": {"gte": 0.12}, "nivo_total_score": {"gte": 60}}},
      {"code": "profitable_mid", "criteria": {"ebitda_margin_latest": {"gte": 0.08}, "revenue_latest": {"gte": 40000000}}}
    ],
    "exclusion_rules": [
      {"field": "revenue_latest", "op": "<=", "value": 15000000},
      {"field": "ebitda_margin_latest", "op": "<=", "value": 0.02}
    ]
  }
  $$::jsonb,
  true,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profile_versions WHERE id = 'f2000001-0000-4000-8000-000000000002'::uuid);

-- 3) Mid-market focus — employee and revenue bands
INSERT INTO public.screening_profiles (id, name, description, owner_user_id, scope)
SELECT
  'f1000001-0000-4000-8000-000000000003'::uuid,
  'Mid-market focus (preset)',
  'Targets mid-sized operators: employees and revenue in typical mid-market ranges.',
  '00000000-0000-0000-0000-000000000001',
  'team'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profiles WHERE id = 'f1000001-0000-4000-8000-000000000003'::uuid);

INSERT INTO public.screening_profile_versions (id, profile_id, version, config_json, is_active, created_by_user_id)
SELECT
  'f2000001-0000-4000-8000-000000000003'::uuid,
  'f1000001-0000-4000-8000-000000000003'::uuid,
  1,
  $$
  {
    "variables": [
      {"id": "employees", "source": "employees_latest", "normalize": "min_max", "range": [20, 800]},
      {"id": "rev", "source": "revenue_latest", "normalize": "min_max", "range": [30000000, 400000000]},
      {"id": "margin", "source": "ebitda_margin_latest", "normalize": "min_max", "range": [0, 0.25]},
      {"id": "fit", "source": "fit_score", "normalize": "min_max", "range": [0, 100]}
    ],
    "weights": {"employees": 0.25, "rev": 0.30, "margin": 0.25, "fit": 0.20},
    "archetypes": [
      {"code": "mid_core", "criteria": {"employees_latest": {"gte": 50, "lte": 500}, "revenue_latest": {"gte": 40000000}}},
      {"code": "regional_champion", "criteria": {"revenue_latest": {"gte": 75000000}, "employees_latest": {"lte": 400}}}
    ],
    "exclusion_rules": [
      {"field": "revenue_latest", "op": "<=", "value": 25000000},
      {"field": "revenue_latest", "op": ">=", "value": 2000000000},
      {"field": "employees_latest", "op": "<=", "value": 10}
    ]
  }
  $$::jsonb,
  true,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profile_versions WHERE id = 'f2000001-0000-4000-8000-000000000003'::uuid);

-- 4) Research-ready — feasibility and enrichment depth
INSERT INTO public.screening_profiles (id, name, description, owner_user_id, scope)
SELECT
  'f1000001-0000-4000-8000-000000000004'::uuid,
  'Research-ready (preset)',
  'Favors companies with strong research feasibility, fit, and Nivo scores for deep work.',
  '00000000-0000-0000-0000-000000000001',
  'team'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profiles WHERE id = 'f1000001-0000-4000-8000-000000000004'::uuid);

INSERT INTO public.screening_profile_versions (id, profile_id, version, config_json, is_active, created_by_user_id)
SELECT
  'f2000001-0000-4000-8000-000000000004'::uuid,
  'f1000001-0000-4000-8000-000000000004'::uuid,
  1,
  $$
  {
    "variables": [
      {"id": "rf", "source": "research_feasibility_score", "normalize": "min_max", "range": [0, 3]},
      {"id": "fit", "source": "fit_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "nivo", "source": "nivo_total_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "dq", "source": "data_quality_score", "normalize": "min_max", "range": [0, 100]}
    ],
    "weights": {"rf": 0.30, "fit": 0.25, "nivo": 0.25, "dq": 0.20},
    "archetypes": [
      {"code": "deep_dive_ready", "criteria": {"research_feasibility_score": {"gte": 1.5}, "fit_score": {"gte": 55}}},
      {"code": "strategic_fit", "criteria": {"fit_score": {"gte": 65}, "nivo_total_score": {"gte": 55}}}
    ],
    "exclusion_rules": [
      {"field": "research_feasibility_score", "op": "<=", "value": 0},
      {"field": "data_quality_score", "op": "<=", "value": 15}
    ]
  }
  $$::jsonb,
  true,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profile_versions WHERE id = 'f2000001-0000-4000-8000-000000000004'::uuid);

-- 5) Balanced scorecard — even spread across core signals
INSERT INTO public.screening_profiles (id, name, description, owner_user_id, scope)
SELECT
  'f1000001-0000-4000-8000-000000000005'::uuid,
  'Balanced scorecard (preset)',
  'Even weights on Nivo total, fit, growth, and margin for a general-purpose shortlist.',
  '00000000-0000-0000-0000-000000000001',
  'team'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profiles WHERE id = 'f1000001-0000-4000-8000-000000000005'::uuid);

INSERT INTO public.screening_profile_versions (id, profile_id, version, config_json, is_active, created_by_user_id)
SELECT
  'f2000001-0000-4000-8000-000000000005'::uuid,
  'f1000001-0000-4000-8000-000000000005'::uuid,
  1,
  $$
  {
    "variables": [
      {"id": "nivo", "source": "nivo_total_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "fit", "source": "fit_score", "normalize": "min_max", "range": [0, 100]},
      {"id": "growth", "source": "revenue_cagr_3y", "normalize": "min_max", "range": [-0.10, 0.25]},
      {"id": "margin", "source": "ebitda_margin_latest", "normalize": "min_max", "range": [0, 0.30]}
    ],
    "weights": {"nivo": 0.25, "fit": 0.25, "growth": 0.25, "margin": 0.25},
    "archetypes": [
      {"code": "all_round", "criteria": {"nivo_total_score": {"gte": 50}, "fit_score": {"gte": 50}}},
      {"code": "growth_quality", "criteria": {"revenue_cagr_3y": {"gte": 0.05}, "ebitda_margin_latest": {"gte": 0.07}}}
    ],
    "exclusion_rules": [
      {"field": "nivo_total_score", "op": "<=", "value": 20},
      {"field": "ebitda_margin_latest", "op": "<=", "value": 0}
    ]
  }
  $$::jsonb,
  true,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM public.screening_profile_versions WHERE id = 'f2000001-0000-4000-8000-000000000005'::uuid);
