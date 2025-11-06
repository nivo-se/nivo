# Supabase Migration Runbook

This runbook describes the step-by-step process for moving the Allabolag data into the new schema (`companies`, `company_financials`, `company_metrics`). Follow the steps in order.

## 0. Prerequisites
- Supabase CLI installed and logged in (`supabase login`)
- `SUPABASE_DB_URL` exported (never commit this value)
- Python ≥ 3.10 (for ETL scripts)
- Latest staging databases:
  - `scraper/allabolag-scraper/staging/staging_151e5a04-14f6-48db-843e-9dad22f371d0.db`
  - `scraper/allabolag-scraper/staging/staging_af674a42-4859-4e15-a641-9da834ddbb09.db`

## 1. Consolidate Staging Data
```bash
python3 scripts/create_staging_snapshot.py \
  --output scraper/allabolag-scraper/staging/staging_50_200_combined.db \
  scraper/allabolag-scraper/staging/staging_151e5a04-14f6-48db-843e-9dad22f371d0.db \
  scraper/allabolag-scraper/staging/staging_af674a42-4859-4e15-a641-9da834ddbb09.db
```

## 2. Back up Legacy Tables
```bash
SUPABASE_DB_URL=postgres://... ./scripts/backup_supabase_tables.sh
```
Backups are stored under `backups/<timestamp>/` for rollback.

## 3. Generate Local Dataset & CSVs
```bash
python3 scripts/migrate_staging_to_new_schema.py \
  --source scraper/allabolag-scraper/staging/staging_50_200_combined.db \
  --local-sqlite data/new_schema_local.db \
  --csv-dir data/csv_export
```
Outputs:
- `data/new_schema_local.db` – local copy for testing
- `data/csv_export/*.csv` – ready for Supabase import

## 4. Create Tables in Supabase
Run `database/new_schema.sql` in the Supabase SQL editor (or via `psql`). This creates the new tables and indexes.

## 5. Load Data into Supabase
Using `psql` (recommended for large CSVs):
```bash
psql "$SUPABASE_DB_URL" -c "\copy companies FROM 'data/csv_export/companies.csv' WITH CSV HEADER"
psql "$SUPABASE_DB_URL" -c "\copy company_financials FROM 'data/csv_export/company_financials.csv' WITH CSV HEADER"
psql "$SUPABASE_DB_URL" -c "\copy company_metrics FROM 'data/csv_export/company_metrics.csv' WITH CSV HEADER"
```

## 6. Validate
Follow `docs/migration/validation_and_rollback.md` to run post-load checks.

## 7. Clean Up Legacy Tables (Optional)
- After validation, archive and drop old tables (`master_analytics`, `company_accounts_by_id`, etc.) as per the retention plan.

## 8. Local Development
- Point analytics notebooks to `data/new_schema_local.db`
- Keep `data/csv_export` for reproducibility or regenerate as needed.

## Rollback
If validation fails:
1. Drop new tables (`DROP TABLE ...`)
2. Restore backups:
   ```bash
   SUPABASE_DB_URL=postgres://... ./scripts/restore_supabase_backup.sh backups/<timestamp>
   ```
3. Re-run the migration when fixes are ready.

## Notes
- Always run the backup step before touching production tables.
- Keep the combined staging snapshot (`staging_50_200_combined.db`) with the migration artifacts for audit.

