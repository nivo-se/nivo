# Database Cleanup Execution Guide

**Date**: 2025-11-17  
**Status**: Ready for Execution

## Overview

This guide provides step-by-step instructions for cleaning up obsolete tables from Supabase. All backend code has been updated to use the new schema, making these tables safe to delete.

## Pre-Cleanup Verification ✅

### 1. Verify New Tables Have Data

Run these queries in Supabase SQL Editor to verify new tables have expected data:

```sql
-- Check row counts
SELECT 
    'companies' as table_name,
    COUNT(*) as row_count
FROM public.companies
UNION ALL
SELECT 'company_financials', COUNT(*) FROM public.company_financials
UNION ALL
SELECT 'company_metrics', COUNT(*) FROM public.company_metrics
UNION ALL
SELECT 'financial_accounts', COUNT(*) FROM public.financial_accounts;
```

**Expected Results**:
- `companies`: ~13,609 rows
- `company_financials`: ~66,614 rows
- `company_metrics`: ~13,609 rows
- `financial_accounts`: ~3,314,236 rows

### 2. Verify Code Updates

All backend code has been updated to use the new schema:
- ✅ `frontend/server/enhanced-server.ts` - Updated valuation functions
- ✅ `frontend/server/industry-benchmarks.ts` - Updated benchmark queries
- ✅ `frontend/server/data-enrichment.ts` - Updated data fetching
- ✅ `frontend/server/ai-analysis-enhanced.ts` - Updated segment benchmarks

**No active code references obsolete tables** (backend only - frontend may still reference but works via API).

## Execution Steps

### Step 1: Backup (Optional but Recommended)

If you want to be extra safe, export the obsolete tables before deletion:

```sql
-- Export obsolete tables (example for master_analytics)
-- Use Supabase dashboard or pg_dump for full backup
```

### Step 2: Review Generated SQL Script

The cleanup SQL script has been generated at:
```
scripts/cleanup_obsolete_tables_generated.sql
```

Review the script to ensure it contains all tables you want to delete.

### Step 3: Execute Cleanup Script

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
2. Copy the contents of `scripts/cleanup_obsolete_tables_generated.sql`
3. Paste into SQL Editor
4. Review the script one more time
5. Click "Run" to execute

**OR** execute via command line (if you have Supabase CLI access):

```bash
psql <your-connection-string> < scripts/cleanup_obsolete_tables_generated.sql
```

### Step 4: Verify Deletion

Run this query to verify old tables are gone:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'master_analytics',
    'master_analytics_backup_20251007',
    'company_accounts_by_id',
    'company_kpis_by_id',
    'companies_enriched',
    'all_companies_raw',
    'scraper_staging_companies',
    'filtered_candidates',
    'final_filter_companies'
)
ORDER BY table_name;
```

**Expected Result**: 0 rows (all tables deleted)

### Step 5: Verify New Tables Still Work

Test that new tables are still accessible:

```sql
-- Test queries
SELECT COUNT(*) FROM public.companies;
SELECT COUNT(*) FROM public.company_metrics;
SELECT COUNT(*) FROM public.financial_accounts;

-- Test a join query
SELECT 
    c.orgnr,
    c.company_name,
    m.latest_revenue_sek,
    m.revenue_cagr_3y
FROM public.companies c
JOIN public.company_metrics m ON c.orgnr = m.orgnr
LIMIT 5;
```

## Tables Being Deleted

### Old Analytics Tables
- `master_analytics` - Replaced by `companies` + `company_metrics`
- `master_analytics_backup_20251007` - Old backup
- `company_kpis` - Replaced by `company_metrics`
- `company_kpis_by_id` - Replaced by `company_metrics`

### Old Financial Tables
- `company_accounts_by_id` - Replaced by `financial_accounts`

### Old Company Tables
- `companies_enriched` - Replaced by `companies` + `company_metrics`
- `all_companies_raw` - Replaced by `companies`

### Old Staging Tables
- `scraper_staging_companies`
- `scraper_staging_company_ids`
- `scraper_staging_jobs`

### Old Filtered/Versioned Tables
- `filtered_companies_basic_filters_*` (multiple versions)
- `filtered_companies_v*` (multiple versions)
- `filtered_candidates`
- `final_filter_companies`

### Old E-commerce Tables
- `digitizable_ecommerce_and_product_companies`
- `digitizable_ecommerce_and_product_companies_backup`

## Tables Being Kept ✅

### Core New Schema
- `companies` - New schema
- `company_financials` - New schema
- `company_metrics` - New schema
- `financial_accounts` - New schema

### AI Tables
- `ai_analysis_runs`
- `ai_company_analysis`
- `ai_analysis_sections`
- `ai_screening_results`
- `ai_analysis_audit`
- `ai_analysis_metrics`

### Valuation Tables
- `valuation_models`
- `valuation_assumptions`
- `valuation_runs`
- `valuation_results`
- `valuation_sessions`

### Utility Tables
- `saved_company_lists`
- `user_roles`

## Rollback Plan

If something goes wrong:

1. **If new tables are accidentally deleted**: Restore from migration scripts
2. **If old tables are needed**: They can be restored from backup (if created)
3. **If code breaks**: All code has been tested and updated, but you can revert code changes if needed

## Post-Cleanup Checklist

- [ ] Old tables verified as deleted
- [ ] New tables verified as accessible
- [ ] Test API endpoints work correctly
- [ ] Test dashboard functions work correctly
- [ ] Check database size reduction
- [ ] Update documentation

## Expected Storage Savings

Old tables currently taking up:
- `master_analytics`: ~3-5 MB
- `company_accounts_by_id`: ~2-3 MB
- `company_kpis_by_id`: ~1-2 MB
- Other old tables: ~1-2 MB
- **Total**: ~7-12 MB

Not huge, but important for:
1. ✅ Clean database structure
2. ✅ Avoid confusion
3. ✅ Prevent accidental queries on old data
4. ✅ Free up space

## Notes

- All `DROP TABLE` statements use `IF EXISTS` and `CASCADE`, so they're safe to run even if tables don't exist
- The script can be run multiple times safely
- Foreign key constraints are handled automatically with `CASCADE`
- No data loss expected - all data has been migrated to new schema

## Support

If you encounter any issues:
1. Check Supabase logs for error messages
2. Verify new tables still have data
3. Test API endpoints to ensure they work
4. Review code changes in `frontend/server/` directory

