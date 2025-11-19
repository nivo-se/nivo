# Financial Accounts Normalization Analysis

## Executive Summary

**Recommendation: YES - Create a normalized `financial_accounts` table**

Extracting account codes from JSONB into a dedicated normalized table will significantly improve:
- **SQL query performance** for calculations and aggregations
- **AI analysis efficiency** by enabling direct SQL operations
- **Data accessibility** for complex analytical queries
- **Maintainability** of financial calculations

## Current State

### Data Storage
- **Location**: `company_financials.account_codes` (JSONB) and `company_financials.raw_json` (JSONB)
- **Format**: Flat map `{"SDI": 72000000, "DR": 1348000000, "RG": 2969900, ...}`
- **Source Files**: Nordstjernan JSON files (`nordstjernan_*_raw.json`) with account arrays

### Current Limitations

1. **JSONB Query Performance**
   - Queries like `account_codes->'RG'` work but are slower than column access
   - Complex calculations require multiple JSONB extractions
   - No efficient way to aggregate across companies by account code

2. **AI Analysis Constraints**
   - AI analysis needs to extract values: `account_codes->'RG'` or `account_codes->'SDI'`
   - Cannot easily join on account codes
   - Cannot efficiently filter companies by specific account code ranges
   - Calculations require application-level JSON parsing

3. **Analytical Queries**
   - Cannot efficiently calculate industry averages for specific account codes
   - Cannot easily compare account codes across years/companies
   - Cannot create pivot tables or cross-tabulations

## Proposed Solution: Normalized `financial_accounts` Table

### Schema Design

```sql
CREATE TABLE public.financial_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_id uuid NOT NULL REFERENCES public.company_financials(id) ON DELETE CASCADE,
    orgnr text NOT NULL REFERENCES public.companies(orgnr) ON DELETE CASCADE,
    year integer NOT NULL,
    period text NOT NULL,
    account_code text NOT NULL,
    amount_sek numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure one account code per financial period
    UNIQUE(financial_id, account_code)
);

-- Indexes for common query patterns
CREATE INDEX idx_financial_accounts_orgnr_year ON public.financial_accounts(orgnr, year DESC);
CREATE INDEX idx_financial_accounts_code ON public.financial_accounts(account_code);
CREATE INDEX idx_financial_accounts_code_year ON public.financial_accounts(account_code, year DESC);
CREATE INDEX idx_financial_accounts_financial_id ON public.financial_accounts(financial_id);
```

### Benefits

#### 1. **SQL Query Performance**
```sql
-- Before (JSONB - slower)
SELECT orgnr, year, 
       (account_codes->>'RG')::numeric as ebit
FROM company_financials
WHERE (account_codes->>'RG')::numeric > 1000000;

-- After (Normalized - faster)
SELECT fa.orgnr, fa.year, fa.amount_sek as ebit
FROM financial_accounts fa
WHERE fa.account_code = 'RG' AND fa.amount_sek > 1000000;
```

#### 2. **AI Analysis Efficiency**
```sql
-- Get all relevant financial metrics for AI analysis in one query
SELECT 
    fa.orgnr,
    fa.year,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) as equity,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) as debt
FROM financial_accounts fa
WHERE fa.orgnr = '556123-4567'
GROUP BY fa.orgnr, fa.year
ORDER BY fa.year DESC;
```

#### 3. **Complex Calculations**
```sql
-- Calculate industry average EBIT margin
SELECT 
    fa.account_code,
    AVG(CASE 
        WHEN revenue.amount_sek > 0 
        THEN (fa.amount_sek / revenue.amount_sek) * 100 
        ELSE NULL 
    END) as avg_margin_pct
FROM financial_accounts fa
JOIN financial_accounts revenue 
    ON revenue.financial_id = fa.financial_id 
    AND revenue.account_code = 'SDI'
WHERE fa.account_code = 'RG'
    AND fa.year = 2024
GROUP BY fa.account_code;
```

#### 4. **Cross-Company Analysis**
```sql
-- Find companies with high equity ratio
SELECT 
    fa.orgnr,
    c.company_name,
    equity.amount_sek as equity,
    assets.amount_sek as total_assets,
    (equity.amount_sek / NULLIF(assets.amount_sek, 0)) * 100 as equity_ratio_pct
FROM financial_accounts equity
JOIN financial_accounts assets 
    ON assets.financial_id = equity.financial_id 
    AND assets.account_code = 'SV'
JOIN companies c ON c.orgnr = equity.orgnr
WHERE equity.account_code = 'EK'
    AND equity.year = 2024
    AND (equity.amount_sek / NULLIF(assets.amount_sek, 0)) * 100 > 50
ORDER BY equity_ratio_pct DESC;
```

## Migration Strategy

### Phase 1: Create Table and Migrate Existing Data

1. **Create the normalized table** (see `financial_accounts_schema.sql`)
2. **Migrate from `account_codes` JSONB**:
   ```sql
   INSERT INTO financial_accounts (financial_id, orgnr, year, period, account_code, amount_sek)
   SELECT 
       cf.id as financial_id,
       cf.orgnr,
       cf.year,
       cf.period,
       key as account_code,
       (value::text)::numeric as amount_sek
   FROM company_financials cf,
   LATERAL jsonb_each_text(cf.account_codes) AS account(key, value)
   WHERE cf.account_codes IS NOT NULL;
   ```

### Phase 2: Import Nordstjernan JSON Files

1. **Parse JSON files** and extract account arrays
2. **Match to existing `company_financials` records** by orgnr/year/period
3. **Insert into `financial_accounts`** table

### Phase 3: Update Data Pipeline

1. **Modify scraper/migration scripts** to insert into both:
   - `company_financials.account_codes` (JSONB) - for backward compatibility
   - `financial_accounts` (normalized) - for new queries

2. **Create triggers** to keep JSONB in sync (optional, for backward compatibility)

## Data Volume Estimates

### Current Data
- **Companies**: ~66,614 financial records (from migration docs)
- **Account codes per record**: ~50-60 codes per company/year
- **Total account rows**: ~3.3M rows (66,614 × 50)

### Storage Impact
- **JSONB storage**: ~500 bytes per record (account_codes)
- **Normalized storage**: ~100 bytes per row (account_code + amount)
- **Total normalized**: ~330MB (vs ~33MB JSONB)
- **Trade-off**: 10x storage for 10-100x query performance improvement

## Performance Comparison

### Query Type: Get EBIT for all companies in 2024

**JSONB Approach:**
```sql
SELECT orgnr, (account_codes->>'RG')::numeric as ebit
FROM company_financials
WHERE year = 2024 AND account_codes ? 'RG';
-- Estimated: 200-500ms for 66K records
```

**Normalized Approach:**
```sql
SELECT orgnr, amount_sek as ebit
FROM financial_accounts
WHERE year = 2024 AND account_code = 'RG';
-- Estimated: 20-50ms for 66K records (10x faster)
```

### Query Type: Calculate average EBIT margin by industry

**JSONB Approach:**
- Requires full table scan with JSONB extraction
- Estimated: 2-5 seconds

**Normalized Approach:**
- Uses index on account_code
- Estimated: 100-300ms (10-50x faster)

## AI Analysis Use Cases

### 1. **Multi-Metric Analysis**
AI analysis often needs multiple account codes simultaneously:
- Revenue (SDI), EBIT (RG), Profit (DR), Equity (EK), Debt (FK)
- With normalized table: Single query with pivots
- With JSONB: Multiple JSONB extractions per row

### 2. **Trend Analysis**
Calculate year-over-year growth for specific account codes:
- Normalized: Simple GROUP BY and window functions
- JSONB: Complex JSONB extraction in subqueries

### 3. **Comparative Analysis**
Compare companies within same industry:
- Normalized: Efficient JOINs and aggregations
- JSONB: Slow JSONB operations in WHERE clauses

### 4. **Dynamic Metric Calculation**
AI might need to calculate custom metrics:
- Normalized: SQL expressions with multiple account codes
- JSONB: Application-level parsing required

## Implementation Checklist

- [ ] Create `financial_accounts` table schema
- [ ] Migrate existing `account_codes` JSONB data
- [ ] Create import script for Nordstjernan JSON files
- [ ] Update migration scripts to populate normalized table
- [ ] Create database views for common queries (optional)
- [ ] Update AI analysis code to use normalized table
- [ ] Add database triggers to keep JSONB in sync (optional)
- [ ] Create indexes for performance optimization
- [ ] Document query patterns and best practices

## Conclusion

**Strong recommendation to create normalized `financial_accounts` table** because:

1. ✅ **Performance**: 10-100x faster for analytical queries
2. ✅ **AI Analysis**: Enables efficient SQL-based calculations
3. ✅ **Scalability**: Better performance as data grows
4. ✅ **Maintainability**: Easier to write and debug queries
5. ✅ **Flexibility**: Supports complex analytical use cases

The storage overhead (10x) is minimal compared to the performance and functionality gains.

