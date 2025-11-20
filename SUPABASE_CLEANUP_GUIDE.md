# Supabase Table Cleanup Guide

## Date: 2025-11-20

## Purpose

Reduce Supabase database storage by deleting large, irrelevant tables that will be replaced in the upcoming dashboard overhaul.

## Current Situation

- Database storage is over limit
- Many tables are not actively used
- Dashboard overhaul coming - new structure will replace old tables
- Need to keep only: Auth tables + essential tables

## Tables to KEEP

### Only Auth Tables (Keep)
- ✅ All Auth tables (managed by Supabase - in `auth` schema)
  - These are required for authentication and cannot be deleted

### All Other Tables Will Be Deleted

Since we're rebuilding the entire backend, ALL application tables will be deleted:
- ❌ `public.companies` - Will be rebuilt
- ❌ `public.company_metrics` - Will be rebuilt
- ❌ `public.stage1_shortlists` - Will be rebuilt
- ❌ `public.stage2_shortlists` - Will be rebuilt
- ❌ `public.saved_company_lists` - Will be rebuilt

## Tables to DELETE

### ALL Application Tables (Delete - Rebuilding entire backend)

**Large/Old Tables:**
1. **`public.company_financials`** ⚠️ LARGE
   - Historical financial statements
   - **This is likely the biggest table**

2. **`public.master_analytics`** ⚠️ OLD
   - Deprecated table

3. **`public.company_accounts_by_id`** ⚠️ OLD
   - Deprecated table

**Core Tables (Will be rebuilt):**
4. **`public.companies`** - Core company data
5. **`public.company_metrics`** - KPI data
6. **`public.stage1_shortlists`** - Shortlists
7. **`public.stage2_shortlists`** - Shortlists
8. **`public.saved_company_lists`** - User lists

### Intelligence Tables (Delete - Will be rebuilt)
**ALL tables in `ai_ops` schema will be deleted:**
- `ai_ops.company_intel`
- `ai_ops.intel_artifacts`
- `ai_ops.company_embeddings`
- `ai_ops.ai_reports`
- `ai_ops.company_rankings`
- `ai_ops.playbooks`
- `ai_ops.decision_log`

**The entire `ai_ops` schema will be dropped** - cleanest approach since we're rebuilding everything.

**Note**: These are used by backend API, but will be rebuilt with new structure in dashboard overhaul.

## Execution Steps

### Step 1: Check Table Sizes

Run this in Supabase SQL Editor to see current sizes:

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Step 2: Review Generated SQL Script

The script `supabase_cleanup.sql` has been generated with all DELETE statements.

**Review carefully** before executing!

### Step 3: Execute Cleanup

1. Open Supabase SQL Editor
2. Copy contents of `supabase_cleanup.sql`
3. Review the DROP statements
4. Execute the script
5. Verify remaining tables

### Step 4: Verify Results

After deletion, run:

```sql
-- Check remaining tables
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('public', 'ai_ops')
ORDER BY schemaname, tablename;

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
```

## Expected Storage Reduction

- **`company_financials`**: Likely 500MB - 1GB+ (largest table)
- **`companies`**: Likely 50-100MB
- **`company_metrics`**: Likely 50-100MB
- **`master_analytics`**: Likely 100-200MB
- **`company_accounts_by_id`**: Likely 100-200MB
- **`stage1_shortlists`**: Likely 10-50MB
- **`stage2_shortlists`**: Likely 10-50MB
- **`saved_company_lists`**: Likely 10-50MB
- **`ai_ops.*` tables**: Likely 50-200MB total

**Total expected reduction**: 800MB - 1.8GB+ (almost entire database except Auth)

## Backend Impact

⚠️ **Note**: Some backend endpoints use `ai_ops` tables:
- `/api/companies/{orgnr}/intel` - Uses `company_intel`, `intel_artifacts`
- `/api/companies/{orgnr}/ai-report` - Uses `ai_reports`

**Action**: These endpoints will return empty/null data after cleanup. This is acceptable since dashboard overhaul is coming.

## After Cleanup

1. ✅ Database storage should be **dramatically reduced** (almost empty)
2. ✅ Only Auth tables remain (required by Supabase)
3. ⚠️ **ALL backend endpoints will stop working** (expected - rebuilding)
4. ✅ **Clean slate** - ready for complete backend rebuild
5. ✅ No legacy data to migrate - fresh start

## Rollback

If you need to rollback:
- Restore from Supabase backup (if available)
- Or recreate tables from migration scripts (data will be lost)

## Next Steps

1. Execute cleanup script
2. Verify storage reduction
3. Proceed with dashboard overhaul
4. Create new optimized table structure
5. Migrate data from local optimized database if needed

