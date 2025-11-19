# Deprecated Columns Guide

## Overview

All `*_sek` columns in the `company_financials` table contain **incorrect values** (1000x too small). These columns have been deprecated and should **NOT be used**.

## Deprecated Columns

### `company_financials` Table

| Column | Status | Issue | Use Instead |
|--------|--------|-------|------------|
| `revenue_sek` | ❌ DEPRECATED | 1000x too small (ratio: 0.001) | `account_codes->>'SDI'` or `financial_accounts` |
| `profit_sek` | ❌ DEPRECATED | 1000x too small (ratio: 0.001) | `account_codes->>'DR'` or `financial_accounts` |
| `ebitda_sek` | ❌ DEPRECATED | 1000x too small (ratio: 0.001) | `account_codes->>'EBITDA'` or `financial_accounts` |
| `equity_sek` | ❌ DEPRECATED | 1000x too small (ratio: 0.001) | `account_codes->>'EK'` or `financial_accounts` |
| `debt_sek` | ❌ DEPRECATED | 1000x too small (ratio: 0.001) | `account_codes->>'FK'` or `financial_accounts` |

## Correct Data Sources

### Option 1: Use `account_codes` JSONB (Recommended)

```sql
-- Get revenue
SELECT (account_codes->>'SDI')::numeric FROM company_financials;

-- Get profit
SELECT (account_codes->>'DR')::numeric FROM company_financials;

-- Get EBIT
SELECT (account_codes->>'RG')::numeric FROM company_financials;

-- Get equity
SELECT (account_codes->>'EK')::numeric FROM company_financials;

-- Get debt
SELECT (account_codes->>'FK')::numeric FROM company_financials;
```

### Option 2: Use `financial_accounts` Table

```sql
-- Get revenue
SELECT amount_sek FROM financial_accounts WHERE account_code = 'SDI';

-- Get all account codes for a company/year
SELECT account_code, amount_sek 
FROM financial_accounts 
WHERE orgnr = '5560001421' AND year = 2024;
```

### Option 3: Use Reliable Views

**`company_financials_reliable`** - View with correct `*_sek` columns from `account_codes`:
```sql
SELECT revenue_sek, profit_sek, ebitda_sek 
FROM company_financials_reliable
WHERE orgnr = '5560001421';
```

**`company_financials_complete`** - Complete view with all account codes:
```sql
SELECT * FROM company_financials_complete
WHERE orgnr = '5560001421';
```

**`financial_accounts_pivot`** - Pivoted view from normalized table:
```sql
SELECT revenue_sek, ebit_sek, profit_sek, ebitda_sek
FROM financial_accounts_pivot
WHERE orgnr = '5560001421';
```

## Account Code Mapping

Reference: `database/allabolag_financial_codes.json`

| Code | Meaning | Swedish | Column Equivalent |
|------|---------|---------|-------------------|
| **SDI** | Revenue | Nettoomsättning | `revenue_sek` |
| **RG** | EBIT | Rörelseresultat | `ebit_sek` |
| **DR** | Net Profit | Årets resultat | `profit_sek` |
| **EBITDA** | EBITDA | EBITDA | `ebitda_sek` |
| **EK** | Equity | Eget kapital | `equity_sek` |
| **FK** | Debt | Finansiella kostnader | `debt_sek` |
| **SV** | Total Assets | Summa tillgångar | `total_assets_sek` |
| **ANT** | Employees | Antal anställda | `employees` |

## Migration Checklist

If you're updating code that uses deprecated columns:

- [ ] Replace `revenue_sek` → `(account_codes->>'SDI')::numeric` or use view
- [ ] Replace `profit_sek` → `(account_codes->>'DR')::numeric` or use view
- [ ] Replace `ebitda_sek` → `(account_codes->>'EBITDA')::numeric` or use view
- [ ] Replace `equity_sek` → `(account_codes->>'EK')::numeric` or use view
- [ ] Replace `debt_sek` → `(account_codes->>'FK')::numeric` or use view
- [ ] Test queries with new data sources
- [ ] Verify values are in expected ranges (50-200 MSEK for revenue)

## Why These Columns Exist

The `*_sek` columns were populated during migration from staging tables, but the staging data was incorrectly scaled. The `account_codes` JSONB field contains the correct values because it comes directly from Allabolag raw JSON.

## Future Plans

1. **Short-term**: Keep columns but mark as deprecated (done)
2. **Medium-term**: Update all code to use `account_codes` or views
3. **Long-term**: Consider removing columns entirely (requires code audit)

## Helper Function

Use `get_account_code()` function for safe extraction:

```sql
SELECT public.get_account_code(account_codes, 'SDI') as revenue_sek
FROM company_financials;
```

This handles NULL values gracefully.

