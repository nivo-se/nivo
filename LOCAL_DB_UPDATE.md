# Local Database Update

## Date: 2025-11-20

## Changes Made

Updated local frontend to use the optimized database instead of the old normalized database.

### Files Updated

1. **`frontend/server/local-db.ts`**
   - Changed database path from `data/new_schema_local.db` to `data/nivo_optimized.db`
   - This is the main database connection file used by the frontend server

2. **`frontend/server/enhanced-server.ts`**
   - Updated `/api/analytics-local` endpoint to use `data/nivo_optimized.db`
   - Updated queries to work with optimized schema:
     - Uses `financials` table instead of `company_metrics` table
     - Calculates metrics on-the-fly from account code columns (sdi_sek, dr_sek, ebitda_sek)
     - Calculates 3-year CAGR from revenue history
     - Calculates margins (EBITDA and net profit) from latest financial data

### Schema Changes

**Old Schema** (new_schema_local.db):
- `companies` table
- `company_financials` table (with JSONB account_codes)
- `company_metrics` table (pre-calculated KPIs)
- `financial_accounts` table (3.3M rows, normalized)

**New Schema** (nivo_optimized.db):
- `companies` table (same structure, but optimized)
- `financials` table (one row per company-year, all account codes as columns)
  - Columns: `sdi_sek`, `dr_sek`, `ebitda_sek`, `ek_sek`, `fk_sek`, etc.
  - 53 account code columns total

### Query Updates

The analytics endpoint now:
1. Gets latest financial data from `financials` table (filtered by year and period='12')
2. Calculates revenue growth (CAGR) from historical revenue data
3. Calculates margins on-the-fly from revenue and profit/EBITDA values
4. Maintains same API response format for compatibility

### Benefits

- ✅ **Smaller database**: 31.7 MB vs 2.1 GB (66x smaller)
- ✅ **Faster queries**: Direct column access, no JSON parsing
- ✅ **Same functionality**: All metrics calculated on-the-fly
- ✅ **Better structure**: Flat schema optimized for analytics

### Testing

To verify the update works:
1. Start the frontend server: `npm run dev` (in frontend/)
2. Check `/api/analytics-local` endpoint
3. Verify dashboard loads correctly
4. Check that all metrics are calculated properly

### Next Steps

- [ ] Test the updated queries with the optimized database
- [ ] Verify all dashboard features work correctly
- [ ] Update any other endpoints that use the local database
- [ ] Consider creating a view or materialized table for frequently-used metrics

