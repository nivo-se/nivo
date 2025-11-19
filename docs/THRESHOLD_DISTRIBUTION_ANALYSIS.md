# Threshold Distribution Analysis

## Executive Summary

After fixing the revenue field issue and implementing continuous/granular scoring, we now have a properly distributed fit_score system with Tier 1-3 segmentation (~100 companies each).

## Problem Identified

### Original Issue
- **Root Cause**: Segmentation view was using `revenue_sek` field (values ~0.1 MSEK) instead of `SDI` from `account_codes` JSONB
- **Impact**: All companies received 0 points for Size Score, resulting in max fit_score of 45
- **Result**: No companies could be differentiated, making tier assignment impossible

### Solution Implemented
1. Updated `company_segment_metrics` view to use `(account_codes->>'SDI')::numeric` for revenue
2. Fixed revenue conversion: SDI is stored in SEK, so divide by 1,000,000 to get MSEK
3. Redesigned scoring formulas to use continuous/granular scoring instead of buckets

## Current Scoring System

### Fit Score Components (0-100 points total)

#### 1. Size Score (0-40 points) - Continuous Scoring
**Revenue Range**: 50-200 MSEK (all companies in database)

- **Sweet Spot (70-150 MSEK)**: 30-40 points (linear)
- **Lower Range (50-70 MSEK)**: 20-30 points (linear)
- **Upper Range (150-200 MSEK)**: 30-35 points (slight penalty)
- **Below 50 MSEK**: Linear penalty (0-20 points)
- **Above 200 MSEK**: Penalty

**Rationale**: Companies in the 70-150 MSEK range are ideal acquisition targets - large enough to be meaningful but not too large to be unaffordable.

#### 2. Profitability Score (0-30 points) - Continuous Scoring
**Based on**: EBITDA Margin (last year)

- **Sweet Spot (5-15%)**: 25-30 points (peak at 10%)
- **Low Margin (0-5%)**: 10-25 points (linear)
- **High Margin (15-25%)**: 20-25 points (slight penalty)
- **Negative Margin**: Penalty (0-10 points)
- **Very High (>25%)**: Penalty (may indicate data issues)

**Rationale**: Moderate profitability (5-15%) indicates room for operational improvement while still being viable.

#### 3. Stability Score (0-30 points) - Granular Scoring

**Growth Component (0-15 points)**:
- **Optimal (2-15% CAGR)**: 10-15 points (peak at 8.5%)
- **High Growth (15-30%)**: 8-10 points (volatility risk)
- **Low/Negative (-5% to 2%)**: 5-10 points
- **Declining (<-5%)**: Penalty
- **Very High (>30%)**: Penalty (volatility)

**Equity Ratio Component (0-15 points)**:
- **Good (25-60%)**: 12-15 points (peak at 40%)
- **Very High (60-80%)**: 10-12 points (under-leverage)
- **Low (10-25%)**: 5-12 points (linear)
- **Very Low (<10%)**: Penalty
- **Extremely High (>80%)**: Slight penalty

**Rationale**: Moderate growth (2-15%) with healthy equity ratio (25-60%) indicates stable, well-capitalized companies.

## Current Distribution

### Fit Score Statistics
- **Min**: 30 points
- **Max**: 65 points
- **Average**: 47.6 points
- **Median**: 48.0 points
- **Range**: 35 points

### Distribution Buckets
- **60-79 points**: 318 companies
- **40-59 points**: 6,763 companies (83%)
- **20-39 points**: 1,052 companies

### Tier Assignment (Based on Ranking)

**Method**: Rank companies by `fit_score DESC, nivo_total_score DESC, ops_upside_score DESC`

- **Tier 1** (top 100): Rank 1-100
  - Average fit_score: 62.8
  - Average ops_score: 69.7
  - Average total_score: 132.5
  - Threshold: fit_score >= 62

- **Tier 2** (next 100): Rank 101-200
  - Average fit_score: 61.2
  - Average ops_score: 67.4
  - Average total_score: 128.6
  - Threshold: fit_score >= 61

- **Tier 3** (next 100): Rank 201-300
  - Average fit_score: 60.1
  - Average ops_score: 67.3
  - Average total_score: 127.3
  - Threshold: fit_score >= 60

- **Unsegmented**: 7,833 companies (fit_score < 60)

## Ops Upside Score (0-100 points)

### Components
1. **Margin Headroom (0-50 points)**: Based on EBITDA margin (3-12% optimal)
2. **Margin Trend (0-25 points)**: Comparing latest vs 3-year average
3. **Growth vs Margin (0-25 points)**: Growth potential with margin headroom

### Current Distribution
- **Average**: 57.8 points
- **Range**: 0-100 points
- **Tier 1 average**: 69.7 points
- **Tier 2 average**: 67.4 points
- **Tier 3 average**: 67.3 points

## Recommendations

### Current System Status
✅ **Working Well**: 
- Fit scores now distributed across 30-65 range (was 0-45)
- Tier assignment working correctly (~100 companies per tier)
- Continuous scoring provides better differentiation

### Potential Improvements
1. **Increase Max Score**: Currently max is 65, could potentially reach 100 with:
   - More companies in sweet spot ranges
   - Better data quality (more complete financials)
   - Additional scoring dimensions

2. **Fine-tune Thresholds**: 
   - Current tier thresholds are very close (60-62)
   - Could adjust component weights to spread scores wider
   - Or add more dimensions (employee count, debt ratios, etc.)

3. **Consider Percentile-Based Scoring**:
   - Would ensure wider distribution by design
   - More robust to data outliers
   - Easier to maintain consistent tier sizes

## Technical Details

### Database Implementation
- **View**: `company_segment_metrics` (materialized)
- **Function**: `calculate_segmentation_scores()`
- **Table**: `company_metrics` (columns: fit_score, ops_upside_score, nivo_total_score, segment_tier)
- **Tier Assignment**: Done via ranking query (ensures exactly 100 per tier)

### Revenue Field Fix
- **Before**: Used `revenue_sek` (incorrect, ~0.1 MSEK)
- **After**: Uses `(account_codes->>'SDI')::numeric` (correct, 50-200 MSEK)
- **Conversion**: Divide by 1,000,000 to convert SEK to MSEK

### Scoring Formula Updates
- **Size Score**: Changed from bucket-based (0/10/30/40) to continuous (0-40)
- **Profitability Score**: Changed from bucket-based (0/20/30) to continuous (0-30)
- **Stability Score**: Changed from binary (+0/+10/+15) to granular continuous (0-30)

## Usage

### Query Tier 1 Companies
```sql
SELECT * FROM company_metrics 
WHERE segment_tier = '1'
ORDER BY fit_score DESC, nivo_total_score DESC;
```

### Query All Tiers
```sql
SELECT 
    segment_tier,
    COUNT(*) as count,
    AVG(fit_score) as avg_fit,
    AVG(ops_upside_score) as avg_ops
FROM company_metrics
WHERE segment_tier IS NOT NULL
GROUP BY segment_tier
ORDER BY segment_tier;
```

### Recalculate Scores
```sql
SELECT public.calculate_segmentation_scores();
```

Then reassign tiers:
```sql
WITH ranked AS (
    SELECT 
        orgnr,
        ROW_NUMBER() OVER (ORDER BY fit_score DESC, nivo_total_score DESC, ops_upside_score DESC) as rank
    FROM company_metrics
)
UPDATE company_metrics cm
SET segment_tier = CASE
    WHEN r.rank <= 100 THEN '1'
    WHEN r.rank > 100 AND r.rank <= 200 THEN '2'
    WHEN r.rank > 200 AND r.rank <= 300 THEN '3'
    ELSE NULL
END
FROM ranked r
WHERE cm.orgnr = r.orgnr;
```

