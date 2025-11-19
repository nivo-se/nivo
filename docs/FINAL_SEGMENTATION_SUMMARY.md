# Final Segmentation Summary

## How Segmentation Works (Verified)

### Data Sources - CORRECT ✅

1. **Primary Source**: `company_financials.account_codes` (JSONB)
   - Contains all Allabolag account codes
   - **SDI** = Revenue (stored in **SEK**, e.g., 95,234,693 SEK = 95.23 MSEK)
   - **RG** = EBIT
   - **DR** = Net Profit
   - **EK** = Equity
   - **FK** = Debt
   - **SV** = Total Assets

2. **Normalized Source**: `financial_accounts` table
   - Each account code as a row
   - Values in **thousands** (from account_codes, divided by 1000)

3. **Segmentation View**: `company_segment_metrics`
   - Uses: `(account_codes->>'SDI')::numeric` ✅ CORRECT
   - Values in SEK (50M-200M SEK = 50-200 MSEK)

4. **Scoring Function**: `calculate_segmentation_scores()`
   - Uses: `revenue_last_year` from view
   - Converts: SEK / 1,000,000 = MSEK for scoring
   - Result: Correct 50-200 MSEK range ✅

### Data Sources - WRONG ❌ (Deprecated)

All `*_sek` columns in `company_financials` table:
- `revenue_sek` - 1000x too small (ratio: 0.001)
- `profit_sek` - 1000x too small (ratio: 0.001)
- `ebitda_sek` - 1000x too small (ratio: 0.001)
- `equity_sek` - 1000x too small (ratio: 0.001)
- `debt_sek` - 1000x too small (ratio: 0.001)

**Status**: Deprecated with warning comments, kept for backward compatibility

## Storage Format Clarification

### account_codes JSONB
- **Format**: Values stored in **SEK** (actual currency units)
- **Example**: SDI = 95,234,693 means 95.23 MSEK
- **Conversion**: Divide by 1,000,000 to get MSEK

### financial_accounts.amount_sek
- **Format**: Values stored in **thousands** (for display convenience)
- **Example**: amount_sek = 95,234 means 95.234 MSEK
- **Conversion**: Divide by 1,000 to get MSEK

### Why Both Formats?
- `account_codes`: Raw from Allabolag (preserves precision)
- `financial_accounts`: Normalized table (easier queries, stored in thousands)

## Segmentation Process Flow

```
1. Data Source: company_financials.account_codes (JSONB)
   └─ SDI = 95,234,693 SEK (correct)

2. Segmentation View: company_segment_metrics
   └─ revenue_last_year = 95,234,693 (from SDI)
   └─ Used directly (in SEK)

3. Scoring Function: calculate_segmentation_scores()
   └─ Converts: 95,234,693 / 1,000,000 = 95.23 MSEK
   └─ Scores based on 50-200 MSEK range ✅

4. Result: Fit scores 30-65, Tier 1-3 assigned ✅
```

## Reliable Views Created

### `company_financials_reliable`
**Purpose**: Drop-in replacement for `company_financials` table
**Source**: Uses `account_codes` JSONB
**Usage**:
```sql
SELECT revenue_sek FROM company_financials_reliable WHERE orgnr = '...';
```

### `company_financials_complete`
**Purpose**: Complete financial data with all account codes as columns
**Source**: Uses `account_codes` JSONB
**Includes**: Revenue, EBIT, Profit, EBITDA, Equity, Debt, Assets, Ratios

### `company_metrics_reliable`
**Purpose**: View with correct `latest_*_sek` values calculated on-the-fly
**Source**: Calculates from `account_codes` dynamically

## Verification Results

✅ **Segmentation View**: Uses SDI correctly
✅ **Scoring Function**: Converts SEK to MSEK correctly
✅ **company_metrics**: Updated with correct values (50-200 MSEK range)
✅ **Tier Assignment**: Working correctly (100 companies per tier)
✅ **Reliable Views**: Created and tested

## Allabolag Code Reference

**File**: `database/allabolag_financial_codes.json`

This file maps all account codes to their meanings. Use it as reference when querying `account_codes` JSONB or `financial_accounts` table.

## Next Steps

1. ✅ **Done**: Deprecated wrong columns
2. ✅ **Done**: Created reliable views
3. ✅ **Done**: Updated company_metrics
4. ⏳ **Pending**: Update frontend code to use reliable views
5. ⏳ **Pending**: Update scripts to use account_codes or views

## Key Takeaways

1. **Always use `account_codes` JSONB** or `financial_accounts` table
2. **Never use** `revenue_sek`, `profit_sek`, etc. columns directly
3. **Use reliable views** for drop-in replacements
4. **Segmentation is correct** - it uses the right data sources
5. **Storage format**: account_codes in SEK, financial_accounts in thousands

