# Data Washing & Segmentation System

## Overview

We've implemented a comprehensive data washing and segmentation system to:
1. **Reduce database size** by filtering out unwanted companies (restaurants, retail, etc.)
2. **Implement Tier A/B segmentation** based on financial metrics scoring

## Data Washing Results

### Before Washing
- **Companies**: 13,609
- **Financial Records**: 66,614
- **Financial Accounts**: 3,314,236 rows

### After Washing
- **Companies**: 8,133 (40% reduction, 5,476 excluded)
- **Financial Records**: 39,716 (40% reduction)
- **Financial Accounts**: 1,979,845 rows (40% reduction)

### Excluded Industries (from `filter_config.json`)
- Restaurants, Hotels, Catering
- Retail (Detaljhandel, Butikshandel)
- Food Wholesale (Livsmedel - agenturer)
- Staffing Agencies (Bemanningsföretag)
- Travel Agencies (Resor)
- And 20+ other non-target sectors

## Storage Optimization

### Combined Optimizations
1. **Data Washing**: 40% fewer companies
2. **Excluded raw_json**: ~200 MB saved
3. **Filtered account_codes**: Only 9 essential codes (vs 50)
4. **Filtered financial_accounts**: 352k rows (vs 3.3M)

### Final CSV Sizes
- `companies.csv`: ~4 MB (washed)
- `company_financials.csv`: ~14 MB (no raw_json)
- `financial_accounts.csv`: ~42 MB (352k rows, 9 codes)
- `company_metrics.csv`: ~2.5 MB

**Expected Supabase Size**: ~150-200 MB (well under 500 MB limit)

## Segmentation System

### SQL Migration
**File**: `database/migrations/001_create_segmentation_system.sql`

Creates:
1. **Materialized View**: `company_segment_metrics`
   - Aggregates per-company metrics from historical financials
   - Includes: revenue_last_year, revenue_3y_cagr, ebitda_margin_last_year, ebitda_margin_3y_avg, equity_ratio_last_year

2. **Scoring Columns** (added to `company_metrics`):
   - `fit_score` (0-100): Size + Profitability + Stability
   - `ops_upside_score` (0-100): Margin headroom + Trend + Growth vs margin
   - `nivo_total_score` (0-200): fit_score + ops_upside_score
   - `segment_tier` ('A', 'B', or NULL)

3. **Scoring Function**: `calculate_segmentation_scores()`
   - Calculates all scores for all companies
   - Assigns Tier A/B based on thresholds

### Scoring Logic

#### Fit Score (0-100)
- **Size Score (0-40)**: Based on revenue_last_year
  - 40 pts: 20-300 MSEK
  - 30 pts: 10-20 MSEK or 300-500 MSEK
  - 10 pts: 5-10 MSEK or 500-800 MSEK
  - 0 pts: otherwise

- **Profitability Score (0-30)**: Based on ebitda_margin_last_year
  - 30 pts: 5-15%
  - 20 pts: 0-5% OR 15-25%
  - 0 pts: <0% or >25%

- **Stability Score (0-30)**: Based on revenue_3y_cagr and equity_ratio
  - +15 pts: revenue_3y_cagr between 2-15%
  - +10 pts: revenue_3y_cagr >15% OR -5% to 0%
  - +15 pts: equity_ratio >25%

#### Ops Upside Score (0-100)
- **Margin Headroom (0-50)**: Based on ebitda_margin_last_year
  - 50 pts: 3-12%
  - 30 pts: 0-3%
  - 20 pts: 12-18%
  - 0 pts: <0% or >18%

- **Margin Trend (0-25)**: Based on margin change vs 3-year avg
  - 25 pts: margins not improving (diff <= 0)
  - 10 pts: slight improvement (0-3 pp)
  - 0 pts: strong improvement (>3 pp)

- **Growth vs Margin (0-25)**: Based on revenue_3y_cagr and ebitda_margin
  - 25 pts: growth >5% AND margin <15%
  - 10 pts: growth 0-5% AND margin 3-15%
  - 0 pts: otherwise

### Tier Assignment
- **Tier A**: fit_score >= 60 AND ops_upside_score >= 60 AND nivo_total_score >= 140
- **Tier B**: fit_score >= 50 AND ops_upside_score >= 50 AND nivo_total_score >= 120
- **Unsegmented**: Otherwise (segment_tier = NULL)

## TypeScript Helper Functions

**File**: `frontend/src/lib/segmentation.ts`

### `getSegmentedTargets(options)`
Fetches Tier A and Tier B companies, ordered by `nivo_total_score DESC`.

```typescript
const { tierA, tierB } = await getSegmentedTargets({
  limitA: 200,  // default
  limitB: 300, // default
  includeMetrics: true
});
```

### `getSegmentationStats()`
Returns counts per tier:
```typescript
const stats = await getSegmentationStats();
// { tierA: 150, tierB: 500, unsegmented: 7483, total: 8133 }
```

### `refreshSegmentationScores()`
Calls the database function to recalculate all scores (requires DB permissions).

## Migration Workflow

1. **Wash Data**:
   ```bash
   python3 scripts/wash_data_before_migration.py
   ```

2. **Export Washed Data**:
   ```bash
   python3 scripts/export_local_db_to_csv_optimized.py \
     --local-db data/new_schema_local_washed.db \
     --csv-dir data/csv_export_washed
   ```

3. **Reset Supabase** (if needed):
   ```sql
   -- Run in Supabase SQL Editor
   -- See scripts/01_reset_supabase_before_migration.sql
   ```

4. **Create Schema**:
   ```sql
   -- Run scripts/03_create_optimized_schema.sql
   ```

5. **Migrate Data**:
   ```bash
   python3 scripts/migrate_to_supabase_python.py
   # Use CSV_DIR=data/csv_export_washed
   ```

6. **Create Segmentation System**:
   ```sql
   -- Run database/migrations/001_create_segmentation_system.sql
   ```

7. **Calculate Scores**:
   ```sql
   SELECT public.calculate_segmentation_scores();
   ```

## Next Steps

1. Review washed data quality
2. Run migration with washed + optimized data
3. Execute segmentation SQL migration
4. Test segmentation functions
5. Integrate Tier A/B filtering into UI

