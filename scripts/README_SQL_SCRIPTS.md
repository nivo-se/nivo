# SQL Scripts for Supabase Migration

These SQL scripts are designed to be run in the **Supabase SQL Editor** (Dashboard → SQL Editor).

## Script Execution Order

### ⚠️  If You Get Timeout Errors
If you see "Connection terminated due to connection timeout", use the split scripts:
1. Run `01a_reset_large_tables_only.sql` (one statement at a time)
2. Run `01b_reset_small_tables.sql` (all at once)
3. See `README_TIMEOUT_FIX.md` for detailed instructions

### 1. Reset Before Migration
**File:** `01_reset_supabase_before_migration.sql` (or use split scripts if timeout)

**Purpose:** Delete all irrelevant tables to reset Supabase before fresh migration.

**When to run:** Before running the Python migration script.

**What it does:**
- Deletes old schema tables (`company_kpis`, `master_analytics_backup_20251007`)
- Deletes old staging tables (`scraper_staging_*`)
- Deletes current new schema tables (will be recreated by migration)
- Keeps utility tables (AI, valuation, user data)

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `01_reset_supabase_before_migration.sql`
3. Paste into SQL Editor
4. Click "Run" or press Cmd/Ctrl + Enter
5. Verify results (script includes verification queries)

---

### 2. Verify Reset
**File:** `02_verify_reset.sql`

**Purpose:** Verify that the reset was successful.

**When to run:** After running `01_reset_supabase_before_migration.sql`

**What it checks:**
- Total table count (should be 12-16 utility tables)
- Lists all remaining tables by category
- Confirms deleted tables are gone
- Checks database size (should be < 50 MB)

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `02_verify_reset.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Review results - all checks should pass ✅

---

### 3. Run Migration
**After verification, run the Python migration:**

```bash
python3 scripts/migrate_to_supabase_python.py
```

This will:
- Create new schema tables
- Load optimized data (only 9 essential account codes)
- Result in ~300-600 MB database (under 500 MB limit after optimization)

---

## Quick Reference

### Tables That Will Be Deleted
- `company_kpis` (old)
- `master_analytics_backup_20251007` (old backup)
- `scraper_staging_*` (old staging)
- `companies` (will be recreated)
- `company_financials` (will be recreated)
- `financial_accounts` (will be recreated)
- `company_metrics` (will be recreated)

### Tables That Will Be Kept
- `ai_analysis_*` (7 tables)
- `valuation_*` (5 tables)
- `saved_company_lists`
- `user_roles`

### Expected Results After Reset
- **Table count:** 12-16 tables (utility tables only)
- **Database size:** < 50 MB
- **Status:** Ready for fresh migration

---

## Troubleshooting

### If verification shows unexpected tables:
1. Check if they're utility tables (AI, valuation, user data)
2. If not, they may need to be added to the delete list
3. Manually delete: `DROP TABLE IF EXISTS public.table_name CASCADE;`

### If database size is still large:
1. Check for large tables: `SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size('public.'||tablename) DESC;`
2. Identify which tables are taking space
3. Delete manually if needed

### If migration fails:
1. Check that reset was successful (run `02_verify_reset.sql`)
2. Verify database is under 50 MB
3. Check migration script logs
4. Re-run migration if needed

