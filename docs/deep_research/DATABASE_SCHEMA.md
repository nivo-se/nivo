# Database schema in this repository

> **This file is no longer a hand-maintained list of three tables.** The real schema is defined by **migrations** and the **database schema spec**.

- **Quick map (public vs `deep_research`):** [docs/nivo/DATA_LAYERS.md](../nivo/DATA_LAYERS.md)
- **Full design reference:** [13_database-schema-spec.md](./13_database-schema-spec.md)
- **DDL history:** [database/migrations/](../../database/migrations/)

The placeholder tables below are **historical**; use the links above for implementation.

| Concern | Location |
|--------|----------|
| Universe / metrics | `public` — see migrations touching `companies`, `company_kpis`, views |
| Screening | `public.screening_*` — see `033_screening_profiles.sql` and later |
| Sourcing chat memory | `public.ai_conversations`, `public.ai_messages` — `051_ai_conversations.sql` |
| Deep research + CRM | `deep_research.*` — see `024_*`, `026_crm_foundation.sql`, and later |
