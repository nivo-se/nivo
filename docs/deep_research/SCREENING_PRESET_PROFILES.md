# Preset screening profiles

Five **team**-scoped Layer 1 profiles are seeded by migration `database/migrations/039_seed_preset_screening_profiles.sql` so new environments have usable defaults.

| Name | Intent |
|------|--------|
| **Growth & momentum (preset)** | Revenue CAGR, scale, fit, ops upside; excludes very weak margins / deep negative growth |
| **Quality & profitability (preset)** | EBITDA margin, Nivo total score, data quality; excludes very small revenue |
| **Mid-market focus (preset)** | Employees + revenue mid-bands; excludes micro and very large revenue / tiny headcount |
| **Research-ready (preset)** | Research feasibility, fit, Nivo, data quality; excludes low feasibility / data quality |
| **Balanced scorecard (preset)** | Even weights on Nivo, fit, growth, margin; general-purpose shortlist |

- **Scope:** `team` — visible to all users in `GET /api/screening/profiles?scope=all`.
- **Idempotency:** Fixed UUIDs; re-running the migration does not duplicate rows.
- **Apply:** `./scripts/run_postgres_migrations.sh` (includes `039`).

Edit the JSON in the migration (or add new versions via the API) to tune weights and exclusions.

## Frontend

On **Screening campaigns** (`/screening-campaigns`), use **New** / **Edit** next to the profile dropdown to create profiles or edit metadata + config JSON (creates a new version and activates it). Only the profile **owner** can save or delete; team presets are owned by the seed user — use **New** or **team** scope + API if you need an editable copy under your account.

### SNI / NACE exclusions (Layer 0)

Campaign creation includes **exclude SNI/NACE prefixes** (e.g. `49` land transport, `64` finance). The API filter `nace_codes` + `excludes_prefixes` drops companies where **any** code in `companies.nace_codes` starts with one of the prefixes. Rows without codes are kept. Results show **Primary SNI** (first code) for manual QA.
