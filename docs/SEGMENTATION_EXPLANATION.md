# Segmentation System Explanation

## How Segmentation Currently Works

### Data Flow

```
Allabolag API
    ↓
Raw JSON (with account codes: SDI, RG, DR, EK, FK, etc.)
    ↓
Staging Table
    ↓
Migration Script
    ↓
company_financials table:
    ├─ account_codes (JSONB) ✅ CORRECT (from raw JSON)
    └─ revenue_sek, profit_sek, etc. ❌ WRONG (deprecated)
    ↓
Segmentation View (company_segment_metrics):
    └─ Uses: account_codes->>'SDI' ✅ CORRECT
    ↓
Scoring Function (calculate_segmentation_scores):
    └─ Uses: revenue_last_year from view ✅ CORRECT
    ↓
company_metrics table:
    ├─ fit_score, ops_upside_score, nivo_total_score ✅ CORRECT
    └─ segment_tier (1, 2, 3, or NULL) ✅ CORRECT
```

## Current Segmentation Process

### Step 1: Data Source
**Table**: `company_financials`

**Correct Source**: `account_codes` JSONB field
- Contains all Allabolag account codes (SDI, RG, DR, EK, FK, etc.)
- Values stored in **SEK** (e.g., 95,234,693 SEK = 95.23 MSEK)
- Source of truth: comes directly from Allabolag raw JSON

**Wrong Source**: `revenue_sek`, `profit_sek`, etc. columns
- ❌ Contains incorrect values (1000x too small)
- ⚠️ **DEPRECATED** - Do not use

### Step 2: Segmentation View
**View**: `company_segment_metrics` (materialized)

**What It Does**:
1. Extracts latest financial data per company
2. Uses `(account_codes->>'SDI')::numeric` for revenue (correct)
3. Calculates 3-year CAGR using SDI values
4. Calculates EBITDA margins using SDI for revenue
5. Calculates equity ratios using EK and SV

**Output Columns**:
- `revenue_last_year`: From SDI (in SEK)
- `revenue_3y_cagr`: Growth rate (%)
- `ebitda_margin_last_year`: Latest EBITDA margin (%)
- `ebitda_margin_3y_avg`: 3-year average margin (%)
- `equity_ratio_last_year`: Equity ratio (%)

### Step 3: Scoring Function
**Function**: `calculate_segmentation_scores()`

**Fit Score (0-100 points)**:
1. **Size Score (0-40)**: Based on revenue_last_year
   - Converts SEK to MSEK: `revenue_last_year / 1,000,000`
   - Sweet spot: 70-150 MSEK gets highest scores
   - Continuous scoring (not buckets)

2. **Profitability Score (0-30)**: Based on EBITDA margin
   - Optimal: 5-15% gets highest scores
   - Continuous scoring (not buckets)

3. **Stability Score (0-30)**: Based on growth + equity ratio
   - Growth: 2-15% CAGR optimal
   - Equity: 25-60% optimal
   - Granular scoring

**Ops Upside Score (0-100 points)**:
1. **Margin Headroom (0-50)**: EBITDA margin 3-12% optimal
2. **Margin Trend (0-25)**: Margins not improving vs historical
3. **Growth vs Margin (0-25)**: Growth potential with margin headroom

**Total Score**: `fit_score + ops_upside_score` (0-200)

### Step 4: Tier Assignment
**Method**: Ranking-based (ensures exactly 100 per tier)

```sql
ORDER BY fit_score DESC, nivo_total_score DESC, ops_upside_score DESC
```

- **Tier 1**: Rank 1-100 (top 100 companies)
- **Tier 2**: Rank 101-200 (next 100 companies)
- **Tier 3**: Rank 201-300 (next 100 companies)
- **Unsegmented**: Rank 301+ (fit_score < 60)

## Data Verification

### ✅ Correct Data Sources

1. **`account_codes` JSONB** in `company_financials`
   - Source: Allabolag raw JSON
   - Format: Values in SEK
   - Verified: SDI values in 50-200 MSEK range ✓

2. **`financial_accounts` table**
   - Normalized account codes
   - Values in thousands (from account_codes)
   - Verified: Correct values ✓

3. **`company_segment_metrics` view**
   - Uses `account_codes->>'SDI'` ✓
   - Verified: Revenue in 50-200 MSEK range ✓

4. **`company_metrics.latest_*_sek` columns**
   - Updated from `account_codes` ✓
   - Verified: Values in 50-200 MSEK range ✓

### ❌ Wrong Data Sources (Deprecated)

1. **`company_financials.revenue_sek`** - 1000x too small
2. **`company_financials.profit_sek`** - 1000x too small
3. **`company_financials.ebitda_sek`** - 1000x too small
4. **`company_financials.equity_sek`** - 1000x too small
5. **`company_financials.debt_sek`** - 1000x too small

## Reliable Views Created

### `company_financials_reliable`
- Uses `account_codes` as source of truth
- All `*_sek` columns come from account_codes
- Drop-in replacement for `company_financials` table

### `company_financials_complete`
- Complete financial data view
- Includes all account codes as columns
- Includes ratios (equity_ratio, ROE, ROA)

### `company_metrics_reliable`
- View with correct `latest_*_sek` values
- Calculated from `account_codes` on-the-fly

## Usage Examples

### Get Revenue (Correct Way)
```sql
-- Option 1: From account_codes
SELECT (account_codes->>'SDI')::numeric FROM company_financials;

-- Option 2: From reliable view
SELECT revenue_sek FROM company_financials_reliable;

-- Option 3: From financial_accounts
SELECT amount_sek FROM financial_accounts WHERE account_code = 'SDI';

-- Option 4: From pivot view
SELECT revenue_sek FROM financial_accounts_pivot;
```

### Get Tier 1 Companies
```sql
SELECT 
    c.orgnr,
    c.company_name,
    cm.fit_score,
    cm.ops_upside_score,
    cm.nivo_total_score,
    cm.segment_tier
FROM company_metrics cm
JOIN companies c ON c.orgnr = cm.orgnr
WHERE cm.segment_tier = '1'
ORDER BY cm.fit_score DESC, cm.nivo_total_score DESC;
```

## Summary

✅ **Segmentation is working correctly** because it uses `account_codes` JSONB field
✅ **All views and functions use correct data sources**
❌ **Direct `*_sek` columns are deprecated** but kept for backward compatibility
✅ **Reliable views created** as drop-in replacements
✅ **company_metrics updated** with correct values from account_codes

The system is now using the correct data sources throughout!

