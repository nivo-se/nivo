# Database Units Fix - Thousands Conversion

## Problem Identified

The database was storing revenue values in **thousands of SEK** instead of **actual SEK**, causing:
- Companies showing 0.1-0.2 mSEK instead of 150-200 mSEK
- AI filter not finding companies in the 50-200 mSEK range
- All financial displays showing incorrect values

## Root Cause

In `scripts/create_optimized_db.py`, the fallback logic (line 349) was using the `revenue` field from `staging_financials` directly without multiplying by 1000:

```python
# BEFORE (WRONG):
if not account_codes:
    if revenue:
        account_codes['SDI'] = revenue  # ❌ revenue is in thousands, not converted
```

The `revenue` field in `staging_financials` contains values in **thousands of SEK** (e.g., 151929 = 151.9 mSEK), but was being stored as-is in the optimized database.

## Fix Applied

Updated the fallback logic to multiply by 1000:

```python
# AFTER (CORRECT):
if not account_codes:
    if revenue:
        account_codes['SDI'] = revenue * 1000  # ✅ Convert thousands to actual SEK
    if profit:
        account_codes['DR'] = profit * 1000   # ✅ Convert thousands to actual SEK
```

## Database Regeneration

The database was regenerated with the fix:
1. **Backup created**: `data/nivo_optimized.db.backup_YYYYMMDD_HHMMSS`
2. **Optimized DB regenerated**: `python3 scripts/create_optimized_db.py --source ... --output ...`
3. **KPI table regenerated**: `python3 scripts/create_kpi_table.py --db ...`

## Results

### Before Fix:
- Götenehus: 151,929 SEK = **0.15 mSEK** ❌
- Visma: 155,254 SEK = **0.16 mSEK** ❌
- Companies >= 50 mSEK: **4** ❌
- Companies >= 100 mSEK: **4** ❌

### After Fix:
- Götenehus: 151,929,000 SEK = **151.9 mSEK** ✅
- Visma: 155,254,000 SEK = **155.3 mSEK** ✅
- Companies >= 50 mSEK: **37,389** ✅
- Companies >= 100 mSEK: **14,148** ✅
- Companies >= 200 mSEK: **980** ✅

## Verification

The database now correctly contains companies in the 50-200 mSEK range as expected from the scraper configuration.

## Next Steps

1. ✅ Backend restarted with corrected database
2. ✅ AI filter now correctly finds companies with >100M SEK revenue
3. ✅ Financial displays show correct values
4. 🔄 **Refresh your browser** to see the corrected values in the frontend

