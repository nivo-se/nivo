# Segmentation Data Sources Explanation

## Current Segmentation Process

### Step 1: Data Source - `company_financials` Table

The segmentation system reads from the `company_financials` table, which has:

**Columns:**
- `revenue_sek` - ⚠️ **WRONG DATA** (values ~0.1 MSEK, should be 50-200 MSEK)
- `account_codes` (JSONB) - ✅ **CORRECT DATA** (contains SDI, RG, DR, etc. with proper values)

**The Problem:**
- `revenue_sek` column exists but contains incorrect values
- Ratio: `revenue_sek / SDI ≈ 0.001` (revenue_sek is 1000x too small)
- This suggests `revenue_sek` was populated incorrectly during migration

### Step 2: Segmentation View - `company_segment_metrics`

**Current Implementation (CORRECT):**
```sql
-- Uses SDI from account_codes JSONB (correct)
(account_codes->>'SDI')::numeric as revenue_last_year
```

**What It Does:**
1. Extracts `SDI` from `account_codes` JSONB field
2. SDI values are stored in **thousands** (e.g., 95,234 = 95.234 MSEK)
3. For scoring, divides by 1,000,000 to convert to MSEK (since SDI is in SEK, not thousands)

**Result:** ✅ Correct revenue values (50-200 MSEK range)

### Step 3: Scoring Function

Uses `revenue_last_year` from the view (which comes from SDI), so scoring is correct.

## Why `revenue_sek` Column Exists and Is Wrong

### Root Cause

Looking at the migration script (`migrate_staging_to_new_schema.py`):
```python
"revenue_sek": row.get("revenue"),  # Already in thousands, no conversion needed
```

**The Issue:**
- Staging table had `revenue` field that was supposed to be in thousands
- But it appears the staging data was already incorrectly scaled
- Or the field was populated from a different source than `account_codes`

**Evidence:**
- `revenue_sek` average: 0.10 MSEK (wrong)
- `SDI` average: 95.23 MSEK (correct)
- Ratio: ~0.001 (revenue_sek is 1000x smaller)

### Why We Should Use `account_codes` Instead

1. **Source of Truth**: `account_codes` comes directly from Allabolag raw JSON
2. **Complete**: Contains all 50+ account codes, not just revenue
3. **Consistent**: All codes stored in same format (thousands)
4. **Mapped**: We have `allabolag_financial_codes.json` with code definitions

## Allabolag Code Mapping

### File: `database/allabolag_financial_codes.json`

This file maps Allabolag account codes to their meanings:

```json
{
  "SDI": { "sv": "Nettoomsättning", "en": "Revenue (Net Sales)" },
  "RG":  { "sv": "Rörelseresultat (EBIT)", "en": "EBIT" },
  "DR":  { "sv": "Årets resultat", "en": "Net Profit" },
  "EK":  { "sv": "Eget kapital", "en": "Equity" },
  "FK":  { "sv": "Finansiella kostnader", "en": "Financial Costs" },
  "SV":  { "sv": "Summa tillgångar", "en": "Total Assets" },
  ...
}
```

### How to Use It

**Instead of:**
```sql
SELECT revenue_sek FROM company_financials  -- WRONG
```

**Use:**
```sql
SELECT (account_codes->>'SDI')::numeric FROM company_financials  -- CORRECT
```

**Or use the normalized table:**
```sql
SELECT amount_sek FROM financial_accounts WHERE account_code = 'SDI'  -- CORRECT
```

## Recommended Solution

### Option 1: Deprecate `revenue_sek` Column (Recommended)

1. **Document** that `revenue_sek` should not be used
2. **Use `account_codes->>'SDI'`** or `financial_accounts` table instead
3. **Keep column** for backward compatibility but mark as deprecated
4. **Update all queries** to use SDI from account_codes

### Option 2: Fix `revenue_sek` Column

1. **Populate from SDI:**
```sql
UPDATE company_financials
SET revenue_sek = (account_codes->>'SDI')::numeric
WHERE account_codes->>'SDI' IS NOT NULL;
```

2. **Add constraint** to keep it in sync:
```sql
-- Add trigger to update revenue_sek when account_codes changes
```

### Option 3: Remove `revenue_sek` Column

1. **Drop column** after ensuring all code uses `account_codes` or `financial_accounts`
2. **Cleaner schema** but requires updating all dependent code

## Current Data Flow

```
Allabolag API
    ↓
Raw JSON (with account codes: SDI, RG, DR, etc.)
    ↓
Staging Table
    ↓
Migration Script
    ↓
company_financials table:
    - account_codes (JSONB) ✅ CORRECT (from raw JSON)
    - revenue_sek (NUMERIC) ❌ WRONG (from staging.revenue field)
    ↓
Segmentation View (company_segment_metrics):
    - Uses account_codes->>'SDI' ✅ CORRECT
    ↓
Scoring Function:
    - Uses revenue_last_year from view ✅ CORRECT
```

## Verification Checklist

✅ **Segmentation View**: Uses `account_codes->>'SDI'` (correct)
✅ **Scoring Function**: Uses view's `revenue_last_year` (correct)
✅ **Revenue Values**: 50-200 MSEK range (correct)
❌ **revenue_sek Column**: Contains wrong values (should be deprecated/fixed)

## Action Items

1. **Document** that `revenue_sek` should not be used
2. **Create mapping** from Allabolag codes to database columns using JSON file
3. **Update all queries** to use `account_codes` or `financial_accounts` table
4. **Consider deprecating** `revenue_sek`, `profit_sek`, etc. columns in favor of `account_codes` JSONB

