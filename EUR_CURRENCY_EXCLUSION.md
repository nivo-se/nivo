# EUR Currency Exclusion Fix

## Date: 2025-11-20

## Problem Identified

**Critical Issue**: Some companies report financial data in EUR instead of SEK, causing incorrect calculations:

1. **Pierce AB (5567631592)**:
   - 2023: 1,486,864 tSEK = 1,486,864,000 SEK ✅
   - 2024: 142,000 EUR (stored as 142,000 SEK in our DB) ❌
   - If treated as SEK: 142,000 SEK (incorrect - should be ~1,562,000 SEK with EUR/SEK ≈ 11)
   - Growth calculation: Comparing EUR 2024 with SEK 2023 gives incorrect results

2. **Fjällräven International AB (5567257471)**:
   - Similar issue - 2024 in EUR, previous years in SEK
   - Growth would be extremely negative if we only used the numbers without currency conversion

### Root Cause

- Allabolag stores values in thousands
- Some companies report in EUR (especially 2024)
- Our database stores EUR values as if they were SEK (no conversion)
- Growth calculations mix EUR and SEK data, causing incorrect results

## Solution Applied

Updated `scripts/create_kpi_table.py` to **exclude EUR records** from KPI calculations:

```python
# EXCLUDE EUR records - only use SEK to avoid currency conversion issues
# Companies reporting in EUR have incorrect values (EUR treated as SEK)
WHERE (period = '12' OR period LIKE '%-12')
  AND year >= 2020
  AND currency = 'SEK'  -- Only use SEK records
```

## Companies Affected

**6 companies reporting in EUR:**
1. Pierce AB (5567631592) - 2024 in EUR
2. Fjällräven International AB (5567257471) - 2024 in EUR
3. Rederi Aktiebolaget Nordö-Link (5565993150) - 2024 in EUR
4. Altor Fund V (No. 2) AB (5591669709) - 2024 in EUR
5. WALLENIUS SOL AB (5591821037) - 2024 in EUR
6. Fidelio Capital III TopCo AB (5593745887) - 2024 in EUR

**All 6 companies have:**
- EUR records for 2024
- SEK records for previous years (2020-2023)
- Mixed currency data causes incorrect growth calculations

## Results After Fix

### Before Fix
- EUR companies included with incorrect values
- Growth calculations comparing EUR 2024 with SEK 2023
- Example: Pierce AB showed -90.45% growth (incorrect)

### After Fix
- EUR records excluded from KPI calculations
- Only SEK records used for growth calculations
- Companies with only EUR data will have NULL revenue/growth
- Companies with mixed data will use latest SEK year (2023) for calculations

### Example: Pierce AB
- **Before**: Latest year 2024 (EUR), Revenue 142,000 SEK, Growth -90.45%
- **After**: Latest year 2023 (SEK), Revenue 1,486,864 SEK, Growth calculated from SEK years only

## Impact

✅ **EUR companies excluded** from growth calculations
✅ **Only SEK data used** for KPIs
✅ **Growth calculations accurate** (no currency mixing)
✅ **6 companies affected** - will use latest SEK year instead of EUR year

## Next Steps

1. ✅ **Fixed**: Exclude EUR records from KPI calculations
2. ⏳ **Optional**: Add currency conversion (EUR to SEK) for future use
3. ⏳ **Optional**: Flag EUR-reporting companies in the database
4. ⏳ **Optional**: Create separate analysis for EUR companies if needed

## Conclusion

✅ **EUR companies are now excluded from KPI calculations:**
- Only SEK records used
- Growth calculations accurate
- No currency mixing issues
- Companies with only EUR data will have NULL KPIs (correct behavior)

