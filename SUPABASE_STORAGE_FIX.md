# Supabase Storage Optimization Guide

## Current Situation
- **Supabase Free Plan Limit**: 500 MB
- **Current Database Size**: ~1.46 GB (291% over limit!)
- **Status**: Database may be READ-ONLY due to exceeding limit

## Main Storage Consumers
1. **financial_accounts**: 1,076 MB (74%) - 3.3M rows
2. **company_financials**: 352 MB (24%) - 66k rows
3. **companies**: 7 MB
4. **company_metrics**: 4 MB

## Quick Fix Script

Run the optimization script to reduce storage:

```bash
# First, check what will be deleted (dry-run)
python3 scripts/optimize_supabase_storage.py

# Then, actually delete the data
python3 scripts/optimize_supabase_storage.py --execute
```

## What the Script Does

### Step 1: Delete Non-Essential Account Codes
- **Keeps only 9 essential codes**: SDI, RG, DR, EBITDA, EK, FK, SV, ANT, EKA
- **Deletes**: All other account codes from `financial_accounts`
- **Expected reduction**: ~800 MB (from 1,076 MB to ~200-300 MB)

### Step 2: Archive Old Data
- **Keeps**: Last 5 years of financial data (2020-2025)
- **Deletes**: Data older than 2019 from both `financial_accounts` and `company_financials`
- **Expected reduction**: ~100-150 MB

### Step 3: Vacuum
- Reclaims disk space from deleted rows
- Final cleanup

## Expected Results

**Before**: ~1,460 MB  
**After**: ~500-600 MB ✅ (under 500 MB limit)

**Storage Savings**: ~900 MB (62% reduction)

## Important Notes

⚠️ **Data Loss**: 
- Non-essential account codes will be permanently deleted
- Old financial data (before 2020) will be permanently deleted

✅ **Essential Data Preserved**:
- All UI metrics (Revenue, EBIT, Profit, EBITDA, etc.) will remain
- Last 5 years of financial data will remain
- All company information will remain

📊 **Local Backup**: 
- Full data still exists in `data/new_schema_local.db` (2.1 GB)
- Can re-import if needed (but will exceed limit again)

## Alternative: Upgrade Supabase Plan

If you need to keep all data:
- **Pro Plan**: $25/month for 8 GB storage
- **Team Plan**: $599/month for 50 GB storage

## Manual SQL Commands

If you prefer to run SQL directly in Supabase SQL Editor:

```sql
-- Step 1: Delete non-essential account codes
DELETE FROM financial_accounts 
WHERE account_code NOT IN ('SDI', 'RG', 'DR', 'EBITDA', 'EK', 'FK', 'SV', 'ANT', 'EKA');

-- Step 2: Delete old financial_accounts data
DELETE FROM financial_accounts 
WHERE year < 2020;

-- Step 3: Delete old company_financials data
DELETE FROM company_financials 
WHERE year < 2020;

-- Step 4: Vacuum
VACUUM FULL financial_accounts;
VACUUM FULL company_financials;

-- Check final size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

## After Optimization

1. ✅ Verify database is under 500 MB
2. ✅ Test frontend to ensure all queries work
3. ✅ Monitor storage usage going forward
4. ✅ Consider data retention policy (auto-archive old data)

## Troubleshooting

### Database is READ-ONLY
If Supabase has put your database in read-only mode:
1. Run the optimization script
2. Wait a few minutes for Supabase to update usage
3. Database should become writable again

### Still Over Limit After Optimization
If still over 500 MB:
1. Reduce to 3 years instead of 5
2. Keep fewer account codes (only SDI, RG, DR, EBITDA)
3. Remove old backup tables if they exist
4. Consider upgrading to Pro plan

