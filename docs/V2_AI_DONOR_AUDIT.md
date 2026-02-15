# V2 AI Donor Audit

Audit of AI-enriched tables in donor project `nivo-v2` (SQLite) for import into this repo's local Postgres.

## Donor DB Path

```text
<USER_PROVIDED_PATH>  # e.g. /path/to/nivo-v2/data/nivo_optimized.db or similar
```

Replace with actual path before running migration.

## This Repo Baseline (data/nivo_optimized.db)

Inspection run: `python3 scripts/inspect_sqlite_db.py --db data/nivo_optimized.db`

| Table        | Rows   | pk        | orgnr_col   |
|-------------|--------|-----------|-------------|
| ai_profiles  | 78     | org_number| org_number  |
| companies    | 13610  | orgnr     | orgnr       |
| company_kpis | 13610  | orgnr     | orgnr       |
| financials   | 66130  | id        | orgnr       |

**ai_profiles columns (this repo):**
- org_number, website, product_description, end_market, customer_types
- strategic_fit_score, defensibility_score, value_chain_position, ai_notes
- industry_sector, industry_subsector, market_regions, business_model_summary
- risk_flags, upside_potential, strategic_playbook, next_steps, agent_type
- scraped_pages, fit_rationale, enrichment_status, last_updated

---

## Donor DB (nivo-v2) – Placeholder

```bash
python3 scripts/inspect_sqlite_db.py --db <DONOR_PATH>
```

| Table  | Rows | pk | orgnr_col | Notes |
|--------|------|-----|-----------|-------|
| (TBD)  |      |     |           | Run inspector to fill |

---

## Recommended Mapping → Postgres

Target Postgres schema: `database/local_postgres_schema.sql` (port 5433).

| Donor table    | Postgres table      | Join key      | Notes                                                |
|----------------|---------------------|---------------|------------------------------------------------------|
| ai_profiles    | ai_profiles         | org_number    | Upsert by org_number; column name normalize orgnr→org_number |
| (about/website)| company_enrichment  | orgnr         | If large structured data; otherwise merge into ai_profiles |
| llm_run / runs | enrichment_runs     | id            | Optional; create if donor has run metadata            |
| company_enrichment | company_enrichment | orgnr, run_id | If donor has per-run enrichment                       |

### Column name normalization

- Donor `orgnr` → Postgres `org_number` (ai_profiles)
- Donor `organization_number` → `org_number`

### New tables (create if needed)

1. **enrichment_runs** (optional):

   ```sql
   CREATE TABLE IF NOT EXISTS public.enrichment_runs (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       model TEXT,
       prompt_version TEXT,
       provider TEXT,
       meta JSONB
   );
   ```

2. **company_enrichment** (if donor has per-run enrichment):

   ```sql
   CREATE TABLE IF NOT EXISTS public.company_enrichment (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       orgnr TEXT NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
       run_id UUID REFERENCES public.enrichment_runs(id),
       result JSONB,
       score NUMERIC,
       tags JSONB,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS idx_company_enrichment_orgnr ON public.company_enrichment(orgnr);
   ```

### What NOT to overwrite

- `companies`, `financials`, `company_kpis` – core dataset; import only AI-related data.
- Existing `ai_profiles` – use upsert (donor data preferred on conflict if newer).

---

## Run commands

```bash
# 1. Inspect donor DB (required before first import)
python3 scripts/inspect_sqlite_db.py --db /path/to/nivo-v2/db.sqlite

# 2. Dry-run migration
python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/nivo-v2/db.sqlite --dry-run

# 3. Run import
python3 scripts/migrate_v2_ai_to_postgres.py --sqlite-path /path/to/nivo-v2/db.sqlite

# 4. Validate (with donor path for comparison)
python3 scripts/validate_v2_ai_import.py --sqlite-path /path/to/nivo-v2/db.sqlite
# Or validate Postgres state only:
python3 scripts/validate_v2_ai_import.py
```
