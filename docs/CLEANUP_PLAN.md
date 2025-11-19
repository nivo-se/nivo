# Cleanup Plan: Delete Old Tables

## Overview
After successful migration and storage optimization, we need to delete all old/unused tables to free up space and avoid confusion.

## Tables to KEEP (New Schema)
✅ **Core Tables:**
- `companies` - New schema (13,609 rows)
- `company_financials` - New schema (66,614 rows)
- `financial_accounts` - New schema (optimized, ~600k rows)
- `company_metrics` - New schema (13,609 rows)

✅ **Utility Tables:**
- `user_roles` - User management
- `saved_company_lists` - User saved lists
- `ai_company_analysis` - AI analysis results
- `ai_analysis_runs` - AI analysis runs
- `ai_analysis_sections` - AI analysis sections
- `ai_screening_results` - AI screening results
- `valuation_sessions` - Valuation sessions
- `valuation_assumptions` - Valuation assumptions
- `valuation_models` - Valuation models
- `valuation_runs` - Valuation runs
- `valuation_results` - Valuation results

## Tables to DELETE (Old Schema)

### Old Analytics Tables
- `master_analytics` - Replaced by `company_metrics`
- `master_analytics_backup_20251007` - Old backup
- `company_kpis` - Replaced by `company_metrics`
- `company_kpis_by_id` - Old KPI table
- `company_accounts_by_id` - Replaced by `financial_accounts`
- `companies_enriched` - Replaced by `companies` + `company_metrics`
- `all_companies_raw` - Old raw data table

### Old Staging Tables
- `scraper_staging_companies` - Old staging table
- `scraper_staging_company_ids` - Old staging table
- `scraper_staging_jobs` - Old staging table

### Old Filtered/Versioned Tables (if they exist)
- `filtered_companies_basic_filters_*` - Old filtered views
- `filtered_companies_v*` - Old versioned tables
- `filtered_candidates` - Old candidates table
- `final_filter_companies` - Old final filter table
- `digitizable_ecommerce_and_product_companies` - Old e-commerce table
- `digitizable_ecommerce_and_product_companies_backup` - Old backup

## Cleanup Scripts

### Option 1: Python Script (Recommended)
```bash
# Dry run first
python3 scripts/cleanup_old_tables.py --dry-run

# Actually delete
python3 scripts/cleanup_old_tables.py --yes
```

### Option 2: SQL Script
```bash
# Run in Supabase SQL Editor
psql < scripts/delete_old_tables.sql
```

## Verification

Before deleting, verify new tables have data:
```sql
SELECT COUNT(*) FROM companies;           -- Should be ~13,609
SELECT COUNT(*) FROM company_financials;  -- Should be ~66,614
SELECT COUNT(*) FROM financial_accounts;  -- Should be ~600k (after optimization)
SELECT COUNT(*) FROM company_metrics;    -- Should be ~13,609
```

After deleting, verify old tables are gone:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'master_analytics',
    'company_accounts_by_id',
    'company_kpis_by_id',
    'companies_enriched',
    'all_companies_raw'
);
-- Should return 0 rows
```

## Expected Storage Savings

Old tables currently taking up:
- `company_kpis`: ~3.7 MB
- `master_analytics_backup_20251007`: ~2.6 MB
- Other old tables: ~1-2 MB
- **Total**: ~7-10 MB

Not huge, but important for:
1. ✅ Clean database structure
2. ✅ Avoid confusion
3. ✅ Prevent accidental queries on old data
4. ✅ Free up any remaining space

## Execution Order

1. ✅ **Wait for optimization to complete** (currently running)
2. ✅ **Verify optimization succeeded** (check database size < 500 MB)
3. ✅ **Verify new tables have data** (run verification queries)
4. ✅ **Run cleanup script** (delete old tables)
5. ✅ **Verify cleanup** (check old tables are gone)
6. ✅ **Final size check** (confirm under 500 MB)

## Safety

- ✅ Script uses `DROP TABLE IF EXISTS` - safe if table doesn't exist
- ✅ Script uses `CASCADE` - handles foreign keys automatically
- ✅ Dry run mode available - preview before deleting
- ✅ Keeps all new tables and utility tables
- ✅ Can be run multiple times safely

