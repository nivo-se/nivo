# Local Testing Checklist

Use this checklist to verify everything is working before migrating to Supabase.

## Pre-Migration Checklist

### 1. Database Structure ✅
- [x] All tables exist (`companies`, `company_financials`, `company_metrics`, `financial_accounts`)
- [x] All indexes created on `financial_accounts`
- [x] Pivot view `financial_accounts_pivot` exists

**Test:** `python3 scripts/test_local_normalization.py --db data/new_schema_local.db`

### 2. Data Integrity ✅
- [x] `financial_accounts` table has data (3.3M+ rows)
- [x] 100% coverage (all financial records have normalized accounts)
- [x] No orphaned account rows

**Test:** `python3 scripts/validate_financial_accounts_local.py --db data/new_schema_local.db`

### 3. Query Functionality ✅
- [x] JSONB queries work
- [x] Normalized queries work
- [x] Pivot queries work
- [x] Data matches between approaches

**Test:** `python3 scripts/test_local_normalization.py --db data/new_schema_local.db`

### 4. Performance ✅
- [x] Normalized queries are significantly faster (100-1000x)
- [x] Indexes are being used

**Test:** `python3 scripts/test_local_normalization.py --db data/new_schema_local.db`

### 5. CSV Export ✅
- [x] `financial_accounts.csv` exists and is valid
- [x] All other CSVs are ready (`companies.csv`, `company_financials.csv`, `company_metrics.csv`)

**Test:** `python3 scripts/export_financial_accounts_to_csv.py --db data/new_schema_local.db --out data/csv_export/financial_accounts.csv`

## Quick Test Commands

```bash
# Run all tests
python3 scripts/test_local_normalization.py --db data/new_schema_local.db

# Validate data integrity
python3 scripts/validate_financial_accounts_local.py --db data/new_schema_local.db

# Export CSVs
python3 scripts/export_financial_accounts_to_csv.py \
  --db data/new_schema_local.db \
  --out data/csv_export/financial_accounts.csv

# Check CSV files
ls -lh data/csv_export/*.csv
```

## Expected Results

- ✅ All tests pass
- ✅ 100% data coverage
- ✅ 100-1000x performance improvement
- ✅ All CSVs exported successfully

## Ready for Supabase Migration

Once all checks pass, you're ready to migrate to Supabase:

```bash
# Full migration (drops and recreates tables)
./scripts/full_migration_local_to_supabase.sh

# Or step-by-step:
# 1. Create schema
psql $SUPABASE_DB_URL -f database/new_schema.sql
psql $SUPABASE_DB_URL -f database/financial_accounts_schema.sql

# 2. Load data
./scripts/load_data_to_supabase.sh
```

## Troubleshooting

### Tests Fail
- Check database path: `ls -lh data/new_schema_local.db`
- Verify schema: `sqlite3 data/new_schema_local.db ".schema financial_accounts"`
- Check data: `sqlite3 data/new_schema_local.db "SELECT COUNT(*) FROM financial_accounts;"`

### Performance Not Improved
- Verify indexes: `sqlite3 data/new_schema_local.db "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'financial_accounts%';"`
- Run ANALYZE: `sqlite3 data/new_schema_local.db "ANALYZE financial_accounts;"`

### CSV Export Fails
- Check database path
- Verify write permissions: `touch data/csv_export/test.csv && rm data/csv_export/test.csv`
- Check disk space: `df -h data/csv_export/`






