# Nivo Postgres — data layers (schema map)

**Purpose:** one-page map of where data lives. For the full design spec, see [docs/deep_research/13_database-schema-spec.md](../deep_research/13_database-schema-spec.md). For applied DDL, see [database/migrations/](../database/migrations/).

## `public` schema (universe, screening, user tools)

- **`companies`**, **`company_metrics`** / views — legal entities and KPIs used for universe query and sourcing filters.
- **`screening_profiles`**, **`screening_profile_versions`** — Layer-1 screening configs (`config_json`, weights, exclusions).
- **`ai_conversations`**, **`ai_messages`** (from `051_ai_conversations.sql`) — optional persisted **sourcing chat** for signed-in users (Auth0 `sub`).

## `deep_research` schema (runs, research artifacts, CRM)

- **`companies`**, **`contacts`**, **`deals`**, **`emails`**, etc. — CRM and deep-research company rows (not always 1:1 with `public.companies` orgnr; link via your app rules).
- **`analysis_runs`**, **`company_profiles`**, and related — pipeline state and outputs for [Deep Research](../deep_research/IMPLEMENTATION_INDEX.md).

## Cross-reference

- Investment mandate (human + machine pointer): [NIVO_INVESTMENT_THESIS.md](./NIVO_INVESTMENT_THESIS.md), `backend/config/nivo_context.json`.
- SQL field rules for the sourcing assistant: [data/rag_context.md](../../data/rag_context.md).
