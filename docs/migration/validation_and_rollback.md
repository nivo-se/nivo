# Migration Validation & Rollback Checklist

This checklist should be executed immediately after loading data into the new schema (`companies`, `company_financials`, `company_metrics`).

## Validation Steps

1. **Record counts**
   - `SELECT COUNT(*) FROM companies;` → expect 13 610 rows
   - `SELECT COUNT(*) FROM company_financials;` → expect 66 614 rows
   - `SELECT COUNT(*) FROM company_metrics;` → expect 13 609 rows (one orgnr lacks company_id)

2. **Missing company IDs**
   - `SELECT orgnr FROM companies WHERE company_id IS NULL;`
   - Confirm only `5568686835` (OC Bygg AB) is missing. Mark as `id_not_found` in tracking.

3. **Revenue spot checks**
   - Compare Supabase values vs local staging for at least three companies per turnover band (sampled in `outputs/data_validation_summary.md`).

4. **Metrics sanity**
   - Ensure `revenue_cagr_3y` and `avg_net_margin` are within plausible ranges (`-1 < value < 5`).
   - `SELECT COUNT(*) FROM company_metrics WHERE revenue_cagr_3y IS NULL;` → manual review (missing historical data is acceptable).

5. **Raw JSON integrity**
   - `SELECT jsonb_typeof(raw_json) FROM company_financials LIMIT 1;` → should return `object`.

6. **Application smoke test**
   - Point local `supabaseDataService` to Supabase and verify dashboards/load flows.

## Rollback Procedure

1. **Ensure backups exist**
   - Use `scripts/backup_supabase_tables.sh` before migration. Backups stored under `backups/<timestamp>/`.

2. **Drop new data tables**
   ```sql
   DROP TABLE IF EXISTS company_metrics;
   DROP TABLE IF EXISTS company_financials;
   DROP TABLE IF EXISTS companies;
   ```

3. **Restore legacy tables**
   - Run `SUPABASE_DB_URL=... ./scripts/restore_supabase_backup.sh backups/<timestamp>`
   - This replays the SQL dumps for `master_analytics`, `company_accounts_by_id`, `company_kpis`, and related tables.

4. **Verify legacy state**
   - Run sanity queries (counts, random sample) to ensure data matches pre-migration snapshot.

5. **Re-run migration when ready**
   - After fixing issues, repeat ETL and validation steps.

## Local Testing

- Use `scripts/migrate_staging_to_new_schema.py` with `--local-sqlite` to produce `data/new_schema_local.db`.
- Point analytics notebooks/dashboards to the local SQLite file for rapid iteration.

## Notes

- All scripts rely on `SUPABASE_DB_URL`; store this securely (not committed).
- CSV exports under `data/csv_export/` can be used with `psql \copy` if the Supabase CLI is unavailable.

