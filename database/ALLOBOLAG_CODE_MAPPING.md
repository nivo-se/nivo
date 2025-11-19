# Allabolag Account Code Mapping

## Overview

This document maps Allabolag account codes to their database representation and usage.

**Source File**: `database/allabolag_financial_codes.json`

## Code Definitions

| Code | Swedish | English | Database Usage | Storage Format |
|------|---------|---------|----------------|----------------|
| **SDI** | Nettoomsättning | Revenue (Net Sales) | ✅ Primary revenue field | Thousands (in account_codes) |
| **RG** | Rörelseresultat (EBIT) | EBIT | ✅ Primary EBIT field | Thousands |
| **DR** | Årets resultat | Net Profit | ✅ Primary profit field | Thousands |
| **EBITDA** | EBITDA | EBITDA | Calculated or from account codes | Thousands |
| **EK** | Eget kapital | Equity | ✅ Equity field | Thousands |
| **FK** | Finansiella kostnader | Financial Costs | Debt calculation | Thousands |
| **SV** | Summa tillgångar | Total Assets | ✅ Total assets | Thousands |
| **ANT** | Antal anställda | Number of Employees | ✅ Employee count | Integer |
| **EKA** | Eget kapitalandel | Equity Ratio | Percentage | Percentage |

## Database Schema Mapping

### `company_financials` Table

**Correct Fields (from account_codes JSONB):**
```sql
(account_codes->>'SDI')::numeric  -- Revenue (in thousands)
(account_codes->>'RG')::numeric   -- EBIT (in thousands)
(account_codes->>'DR')::numeric   -- Net Profit (in thousands)
(account_codes->>'EK')::numeric   -- Equity (in thousands)
(account_codes->>'SV')::numeric   -- Total Assets (in thousands)
```

**Deprecated Fields (DO NOT USE):**
```sql
revenue_sek  -- ❌ WRONG VALUES (use SDI instead)
profit_sek   -- ⚠️ Check if correct (use DR instead)
```

### `financial_accounts` Table

**Normalized Account Codes:**
```sql
SELECT amount_sek 
FROM financial_accounts 
WHERE account_code = 'SDI'  -- Revenue
```

**All codes stored as rows:**
- `account_code`: 'SDI', 'RG', 'DR', etc.
- `amount_sek`: Value in thousands

## Usage Guidelines

### ✅ DO: Use account_codes JSONB
```sql
-- Get revenue
SELECT (account_codes->>'SDI')::numeric FROM company_financials;

-- Get EBIT
SELECT (account_codes->>'RG')::numeric FROM company_financials;

-- Get profit
SELECT (account_codes->>'DR')::numeric FROM company_financials;
```

### ✅ DO: Use financial_accounts table
```sql
-- Get revenue
SELECT amount_sek FROM financial_accounts WHERE account_code = 'SDI';

-- Get all account codes for a company
SELECT account_code, amount_sek 
FROM financial_accounts 
WHERE orgnr = '5560001421' AND year = 2024;
```

### ❌ DON'T: Use revenue_sek column
```sql
-- WRONG - contains incorrect values
SELECT revenue_sek FROM company_financials;
```

## Conversion Notes

### Storage Format
- **account_codes JSONB**: Values stored in **thousands** (e.g., 95,234 = 95.234 MSEK)
- **financial_accounts.amount_sek**: Values stored in **thousands**
- **For MSEK**: Divide by 1,000
- **For actual SEK**: Multiply by 1,000

### Example
```sql
-- SDI value: 95,234 (in thousands)
-- In MSEK: 95.234 MSEK
-- In actual SEK: 95,234,000 SEK

SELECT 
    (account_codes->>'SDI')::numeric / 1000.0 as revenue_msek,
    (account_codes->>'SDI')::numeric * 1000.0 as revenue_sek_actual
FROM company_financials;
```

## Segmentation System Usage

The segmentation system correctly uses:
1. **View**: `company_segment_metrics.revenue_last_year` ← from `account_codes->>'SDI'`
2. **Scoring**: Uses view's revenue (correct)
3. **Result**: Proper 50-200 MSEK range

## Migration Notes

When migrating data:
1. **Extract** account codes from Allabolag raw JSON
2. **Store** in `account_codes` JSONB field
3. **Populate** `financial_accounts` table from account_codes
4. **DO NOT** populate `revenue_sek` from staging.revenue (it's wrong)
5. **Instead** populate from `account_codes->>'SDI'` if needed

## Recommended Schema Changes

### Option 1: Deprecate Direct Columns
- Keep `revenue_sek`, `profit_sek` for backward compatibility
- Mark as deprecated in documentation
- All new code uses `account_codes` or `financial_accounts`

### Option 2: Remove Direct Columns
- Drop `revenue_sek`, `profit_sek`, etc.
- Force all code to use `account_codes` or `financial_accounts`
- Cleaner schema, but requires code updates

### Option 3: Fix Direct Columns
- Populate `revenue_sek` from `account_codes->>'SDI'`
- Add triggers to keep in sync
- More maintenance overhead

**Recommendation**: Option 1 (deprecate but keep for compatibility)

