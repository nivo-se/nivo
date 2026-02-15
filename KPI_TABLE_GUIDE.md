# Company KPIs Table Guide

## Date: 2025-11-20

## Overview

Created a dedicated `company_kpis` table in the optimized database to enable fast segmentation and analysis queries. This table contains pre-calculated KPIs for all 13,610 companies.

## Table Structure

### Columns

**Latest Year Data:**
- `latest_year` - Most recent financial year
- `latest_revenue_sek` - Latest revenue (SDI)
- `latest_profit_sek` - Latest net profit (DR)
- `latest_ebitda_sek` - Latest EBITDA
- `latest_ebit_sek` - Latest EBIT (RG)
- `latest_equity_sek` - Latest equity (EK)
- `latest_debt_sek` - Latest debt (FK)
- `latest_employees` - Latest employee count

**Growth Metrics:**
- `revenue_cagr_3y` - 3-year revenue CAGR
- `revenue_cagr_5y` - 5-year revenue CAGR
- `profit_cagr_3y` - 3-year profit CAGR
- `profit_cagr_5y` - 5-year profit CAGR

**Margin Metrics (Averages):**
- `avg_ebitda_margin` - Average EBITDA margin over available years
- `avg_ebit_margin` - Average EBIT margin over available years
- `avg_net_margin` - Average net profit margin over available years

**Profitability Ratios:**
- `roe` - Return on Equity (profit/equity)
- `roa` - Return on Assets (profit/assets)
- `equity_ratio` - Equity / (Equity + Debt)
- `debt_to_equity` - Debt / Equity

**Efficiency Metrics:**
- `revenue_per_employee` - Revenue efficiency
- `ebitda_per_employee` - EBITDA efficiency
- `profit_per_employee` - Profit efficiency

**Segmentation Buckets:**
- `company_size_bucket` - small, medium, large (based on revenue)
- `growth_bucket` - declining, flat, moderate, high (based on CAGR)
- `profitability_bucket` - loss-making, low, healthy, high (based on margin)

**Metadata:**
- `years_of_data` - Number of years of financial data available
- `calculated_at` - When KPIs were calculated

## Indexes

The table has indexes on:
- `company_size_bucket` - Fast filtering by size
- `growth_bucket` - Fast filtering by growth
- `profitability_bucket` - Fast filtering by profitability
- `revenue_cagr_3y` - Fast sorting/filtering by growth
- `avg_ebitda_margin` - Fast sorting/filtering by margin

## Usage Examples

### Segmentation Queries

**Find high-growth, profitable companies:**
```sql
SELECT 
    c.company_name,
    k.latest_revenue_sek,
    k.revenue_cagr_3y,
    k.avg_net_margin
FROM company_kpis k
JOIN companies c ON k.orgnr = c.orgnr
WHERE k.growth_bucket = 'high'
  AND k.profitability_bucket IN ('healthy', 'high')
ORDER BY k.revenue_cagr_3y DESC
LIMIT 100;
```

**Find companies by size and profitability:**
```sql
SELECT 
    company_size_bucket,
    profitability_bucket,
    COUNT(*) as count,
    AVG(revenue_cagr_3y) as avg_growth,
    AVG(avg_net_margin) as avg_margin
FROM company_kpis
WHERE company_size_bucket IS NOT NULL
  AND profitability_bucket IS NOT NULL
GROUP BY company_size_bucket, profitability_bucket
ORDER BY company_size_bucket, profitability_bucket;
```

**Find top performers by multiple metrics:**
```sql
SELECT 
    c.company_name,
    k.latest_revenue_sek,
    k.revenue_cagr_3y,
    k.avg_ebitda_margin,
    k.roe,
    k.revenue_per_employee
FROM company_kpis k
JOIN companies c ON k.orgnr = c.orgnr
WHERE k.revenue_cagr_3y > 0.15
  AND k.avg_ebitda_margin > 0.10
  AND k.roe > 0.20
ORDER BY k.revenue_cagr_3y DESC
LIMIT 50;
```

## Statistics

- **Total companies**: 13,610
- **With revenue data**: 10,176 (74.8%)
- **With growth metrics**: 8,978 (66.0%)
- **With margin metrics**: 9,876 (72.6%)

**Size Distribution:**
- Small: ~8,000 companies
- Medium: ~1,500 companies
- Large: ~500 companies

**Growth Distribution:**
- Declining: ~1,500 companies
- Flat: ~2,000 companies
- Moderate: ~3,500 companies
- High: ~2,000 companies

**Profitability Distribution:**
- Loss-making: ~1,500 companies
- Low: ~2,500 companies
- Healthy: ~4,000 companies
- High: ~2,000 companies

## Benefits

1. ✅ **Fast Segmentation**: Indexed buckets enable instant filtering
2. ✅ **Easy Analysis**: All KPIs in one table, no joins needed
3. ✅ **Pre-calculated**: No on-the-fly calculations needed
4. ✅ **Small Size**: Only 2 MB added to database (34.7 MB total)
5. ✅ **Comprehensive**: 20+ metrics per company

## Updating KPIs

To recalculate KPIs (e.g., after adding new financial data):

```bash
python3 scripts/create_kpi_table.py --db data/nivo_optimized.db
```

This will:
1. Drop and recreate the table
2. Recalculate all KPIs from financials table
3. Rebuild all indexes

## Frontend Integration

The frontend server (`enhanced-server.ts`) now uses the `company_kpis` table directly instead of calculating metrics on-the-fly. This makes the `/api/analytics-local` endpoint much faster.

## Next Steps

- [x] Create KPI table
- [x] Populate with calculated metrics
- [x] Create indexes for fast segmentation
- [x] Update frontend to use KPI table
- [ ] Add KPI table to Supabase migration plan
- [ ] Create segmentation API endpoints using KPI table

