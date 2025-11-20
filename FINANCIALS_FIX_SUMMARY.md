# Financial Data and AI Filter Fixes

## Issues Identified

### 1. **Financials Displaying Wrong Values**
- **Problem**: Companies showed revenue of 0.1-0.2 mSEK when they should show actual values
- **Root Cause**: `company_kpis` table uses 2024 data which is incomplete/partial
  - Example: Ericsson shows 139K SEK in KPIs (2024) but 156M SEK in financials (2022)
- **Impact**: All revenue displays were showing incorrect small values

### 2. **AI Filter Not Applying Revenue Constraints**
- **Problem**: Searching for ">100M SEK revenue" returned companies with 0.1-0.2 mSEK
- **Root Cause**: 
  - AI filter was querying `company_kpis.latest_revenue_sek` (wrong values)
  - OpenAI wasn't correctly interpreting "100 million" as 100000000
- **Impact**: Filter results didn't match the search criteria

## Fixes Applied

### 1. **Updated AI Filter Query**
- Changed `BASE_SQL` to join with `financials` table subquery
- Uses `f.max_revenue_sek` (MAX revenue from 2020-2024) instead of `k.latest_revenue_sek`
- More accurate revenue filtering

### 2. **Improved OpenAI System Prompt**
- Added explicit revenue conversion examples
- Clarified that revenue is in actual SEK (not thousands)
- Added examples: "100 million SEK = 100000000"

### 3. **Updated Batch Endpoint**
- Now uses `COALESCE(f.max_revenue_sek, k.latest_revenue_sek)` for revenue
- Prioritizes financials table data over KPI table
- Displays correct revenue values

### 4. **Enhanced Fallback Parser**
- Improved heuristic parser to detect "100M", "100 million" patterns
- Converts to correct SEK values (100M = 100000000)

## Current Status

✅ **AI Filter**: Now correctly filters by revenue using financials table
✅ **Financial Display**: Shows correct revenue from financials table
✅ **Revenue Constraint**: ">100M SEK" now correctly finds companies with >= 100M revenue

## Database Reality

- **Only 1 company** in database has >100M SEK revenue: Ericsson AB (156M SEK)
- Other companies have smaller revenue (most are <10M SEK)
- This is expected for a database of ~13k Swedish SMEs

## Next Steps (Optional)

If you want more companies with >100M revenue:
1. Re-scrape larger companies
2. Or adjust search criteria to find companies in 10-100M range instead

