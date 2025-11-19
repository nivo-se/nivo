# Database Views Explanation

**Date**: 2025-11-17

## Overview

Your database contains **4 views** that are safe to keep. Views don't store duplicate data - they're just convenient query shortcuts that make it easier to access data.

## Views in Your Database

### 1. `financial_accounts_pivot` (VIEW)
**Purpose**: Pivots the `financial_accounts` table so account codes become columns  
**Source**: `financial_accounts` table  
**Use Case**: Makes it easier to query revenue, profit, EBITDA, etc. without joining  
**Example**:
```sql
-- Instead of this:
SELECT 
    MAX(CASE WHEN account_code = 'SDI' THEN amount_sek END) as revenue_sek,
    MAX(CASE WHEN account_code = 'DR' THEN amount_sek END) as profit_sek
FROM financial_accounts
WHERE orgnr = '...' AND year = 2024
GROUP BY orgnr, year;

-- You can do this:
SELECT revenue_sek, profit_sek 
FROM financial_accounts_pivot
WHERE orgnr = '...' AND year = 2024;
```

**Status**: ✅ **KEEP** - Useful query shortcut

---

### 2. `company_financials_reliable` (VIEW)
**Purpose**: Provides reliable financial data using `account_codes` JSONB as source of truth  
**Source**: `company_financials` table (reads from `account_codes` field)  
**Use Case**: Drop-in replacement for `company_financials` with correct values  
**Why Needed**: The direct columns (`revenue_sek`, `profit_sek`) in `company_financials` had data quality issues, so this view extracts from the reliable `account_codes` JSONB field

**Status**: ✅ **KEEP** - Provides reliable data access

---

### 3. `company_financials_complete` (VIEW)
**Purpose**: Complete financial data view with all account codes as columns  
**Source**: `company_financials` table  
**Use Case**: Provides comprehensive financial data including ratios (ROE, ROA, equity_ratio)  
**Includes**: Revenue, EBIT, Profit, EBITDA, Equity, Debt, Assets, and calculated ratios

**Status**: ✅ **KEEP** - Comprehensive financial view

---

### 4. `company_metrics_reliable` (VIEW)
**Purpose**: Reliable metrics view with correct `latest_*_sek` values  
**Source**: Calculates from `company_financials.account_codes` dynamically  
**Use Case**: Provides correct latest revenue/profit/EBITDA values calculated on-the-fly  
**Why Needed**: Ensures `latest_revenue_sek`, `latest_profit_sek`, etc. are always correct

**Status**: ✅ **KEEP** - Ensures data accuracy

---

## Missing View?

You might also have `company_segment_metrics` which is a **MATERIALIZED VIEW** (not a regular view). Materialized views store computed data for performance, but they're still safe to keep if they're actively used.

## Key Points

1. **Views don't duplicate data** - They're just stored SQL queries
2. **Views improve query performance** - Pre-computed joins and transformations
3. **Views provide data consistency** - Ensure correct data access patterns
4. **Views are safe to keep** - No storage overhead, only convenience

## Recommendation

✅ **Keep all views** - They're useful query shortcuts that don't store duplicate data.

If you want to see what a view does, you can query:
```sql
SELECT pg_get_viewdef('public.financial_accounts_pivot', true);
```

This will show you the SQL query that defines the view.

