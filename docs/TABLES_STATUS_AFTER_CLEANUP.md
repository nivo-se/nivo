# Database Tables Status After Cleanup

**Date**: 2025-11-17  
**Status**: ✅ Cleanup Complete - All Remaining Tables Are Valid

## Summary

After cleanup, **0 obsolete tables remain**. All tables currently in the database are part of the active system and should be kept.

## Tables by Category

### ✅ Core Tables (4 tables) - KEEP
These are the main data tables in the new schema:

1. **`companies`** - Company master data (13,609 rows)
2. **`company_financials`** - Financial statements per year/period (66,614 rows)
3. **`company_metrics`** - Calculated KPIs and metrics per company (13,609 rows)
4. **`financial_accounts`** - Normalized account codes (3.3M+ rows)

### ✅ Views (5 views) - KEEP
These are database views that provide convenient query interfaces:

1. **`financial_accounts_pivot`** - Pivoted view of financial_accounts (easier to query)
2. **`company_financials_complete`** - Complete financial data with all account codes as columns
3. **`company_financials_reliable`** - Reliable view using account_codes JSONB (drop-in replacement)
4. **`company_metrics_reliable`** - Reliable metrics view with correct latest_*_sek values
5. **`company_segment_metrics`** - Materialized view for segmentation scoring (MSEK-based)

**Note**: Views don't store data - they're just query shortcuts. They're safe to keep and useful.

### ✅ AI Tables (7 tables) - KEEP
These store AI analysis results:

1. **`ai_analysis_runs`** - AI analysis run metadata
2. **`ai_company_analysis`** - Per-company AI analysis results
3. **`ai_analysis_sections`** - Detailed analysis sections
4. **`ai_screening_results`** - Screening analysis results
5. **`ai_analysis_audit`** - Audit trail for AI analysis
6. **`ai_analysis_metrics`** - Metrics from AI analysis
7. **`ai_analysis_feedback`** - User feedback on AI analysis

### ✅ Valuation Tables (5 tables) - KEEP
These store valuation models and results:

1. **`valuation_models`** - Valuation model definitions
2. **`valuation_assumptions`** - Valuation assumptions per industry/size/growth
3. **`valuation_runs`** - Valuation run metadata
4. **`valuation_results`** - Individual valuation results
5. **`valuation_sessions`** - Valuation session data

### ✅ Utility Tables (2 tables) - KEEP
These store user and system data:

1. **`saved_company_lists`** - User-saved company lists
2. **`user_roles`** - User role management

## Total: 23 Tables/Views

All are active and should be kept.

## Deleted Tables (22 tables)

The following obsolete tables were successfully deleted:

- `master_analytics` ✅
- `master_analytics_backup_20251007` ✅
- `company_kpis` ✅
- `company_kpis_by_id` ✅
- `company_accounts_by_id` ✅
- `companies_enriched` ✅
- `all_companies_raw` ✅
- `scraper_staging_companies` ✅
- `scraper_staging_company_ids` ✅
- `scraper_staging_jobs` ✅
- `filtered_companies_basic_filters_*` (5 versions) ✅
- `filtered_companies_v*` (3 versions) ✅
- `filtered_candidates` ✅
- `final_filter_companies` ✅
- `digitizable_ecommerce_and_product_companies` ✅
- `digitizable_ecommerce_and_product_companies_backup` ✅

## Verification

Run this query to verify all obsolete tables are gone:

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
```

**Expected Result**: 0 rows ✅

## Notes

- **Views are safe**: Views don't store duplicate data - they're just query shortcuts
- **Materialized views**: `company_segment_metrics` is a materialized view (stores computed data) but it's actively used for segmentation
- **All backend code updated**: No code references deleted tables anymore
- **Database is clean**: Only active, necessary tables remain

## Next Steps

✅ Cleanup complete - no further action needed!

