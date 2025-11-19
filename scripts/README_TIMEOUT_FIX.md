# Fixing Connection Timeout Errors

If you get **"Connection terminated due to connection timeout"** when running the reset script, use this approach:

## Problem
Large tables (especially `financial_accounts` at ~1GB) take too long to drop in a single transaction, causing timeouts.

## Solution: Run Tables Individually

### Step 1: Drop Large Tables One at a Time

Run `01a_reset_large_tables_only.sql` **one statement at a time**:

1. Copy **only the first statement**:
   ```sql
   DROP VIEW IF EXISTS public.financial_accounts_pivot CASCADE;
   ```
2. Paste into Supabase SQL Editor
3. Click "Run"
4. **Wait for completion** (check for ✅ success message)
5. Repeat for next statement

**Important:** Wait for each statement to complete before running the next one!

### Step 2: Drop Small Tables

After all large tables are dropped, run `01b_reset_small_tables.sql` (can run all at once - these are small).

### Step 3: Verify

Run `02_verify_reset.sql` to confirm everything was deleted.

## Alternative: Use TRUNCATE First

If DROP still times out, try TRUNCATE first (faster), then DROP:

```sql
-- Truncate first (faster - just deletes data)
TRUNCATE TABLE public.financial_accounts CASCADE;

-- Then drop (faster now that it's empty)
DROP TABLE IF EXISTS public.financial_accounts CASCADE;
```

## Expected Timing

- `financial_accounts` (1GB): 30-60 seconds
- `company_financials` (350MB): 10-20 seconds  
- Other tables: < 5 seconds each

## If Still Timing Out

1. Check if there are active connections to the tables
2. Try during off-peak hours
3. Contact Supabase support if persistent

