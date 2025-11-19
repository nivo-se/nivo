-- Example SQL Queries for Normalized Financial Accounts Table
-- These queries demonstrate the power of normalized data for AI analysis

-- ============================================================================
-- 1. BASIC QUERIES
-- ============================================================================

-- Get all account codes for a specific company and year
SELECT 
    account_code,
    amount_sek,
    period
FROM financial_accounts
WHERE orgnr = '556123-4567' AND year = 2024
ORDER BY account_code;

-- Get specific metrics for a company across years
SELECT 
    year,
    MAX(CASE WHEN account_code = 'SDI' THEN amount_sek END) as revenue,
    MAX(CASE WHEN account_code = 'RG' THEN amount_sek END) as ebit,
    MAX(CASE WHEN account_code = 'DR' THEN amount_sek END) as profit
FROM financial_accounts
WHERE orgnr = '556123-4567'
GROUP BY year
ORDER BY year DESC;

-- ============================================================================
-- 2. AI ANALYSIS QUERIES
-- ============================================================================

-- Get comprehensive financial profile for AI analysis
SELECT 
    fa.orgnr,
    c.company_name,
    fa.year,
    fa.period,
    -- Revenue metrics
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue_sek,
    -- Profitability metrics
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit_sek,
    MAX(CASE WHEN fa.account_code = 'EBITDA' THEN fa.amount_sek END) as ebitda_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit_sek,
    -- Balance sheet metrics
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) as equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) as debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) as total_assets_sek,
    -- Operational metrics
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) as employees,
    -- Ratios
    MAX(CASE WHEN fa.account_code = 'EKA' THEN fa.amount_sek END) as equity_ratio_pct,
    MAX(CASE WHEN fa.account_code = 'avk_eget_kapital' THEN fa.amount_sek END) as roe_pct,
    MAX(CASE WHEN fa.account_code = 'avk_totalt_kapital' THEN fa.amount_sek END) as roa_pct
FROM financial_accounts fa
JOIN companies c ON c.orgnr = fa.orgnr
WHERE fa.orgnr = '556123-4567'
GROUP BY fa.orgnr, c.company_name, fa.year, fa.period
ORDER BY fa.year DESC;

-- ============================================================================
-- 3. CALCULATED METRICS
-- ============================================================================

-- Calculate EBIT margin (EBIT / Revenue)
SELECT 
    fa.orgnr,
    fa.year,
    revenue.amount_sek as revenue_sek,
    ebit.amount_sek as ebit_sek,
    CASE 
        WHEN revenue.amount_sek > 0 
        THEN (ebit.amount_sek / revenue.amount_sek) * 100 
        ELSE NULL 
    END as ebit_margin_pct
FROM financial_accounts ebit
JOIN financial_accounts revenue 
    ON revenue.financial_id = ebit.financial_id 
    AND revenue.account_code = 'SDI'
WHERE ebit.account_code = 'RG'
    AND ebit.year = 2024
ORDER BY ebit_margin_pct DESC NULLS LAST;

-- Calculate equity ratio (Equity / Total Assets)
SELECT 
    fa.orgnr,
    c.company_name,
    fa.year,
    equity.amount_sek as equity_sek,
    assets.amount_sek as total_assets_sek,
    CASE 
        WHEN assets.amount_sek > 0 
        THEN (equity.amount_sek / assets.amount_sek) * 100 
        ELSE NULL 
    END as equity_ratio_pct
FROM financial_accounts equity
JOIN financial_accounts assets 
    ON assets.financial_id = equity.financial_id 
    AND assets.account_code = 'SV'
JOIN companies c ON c.orgnr = equity.orgnr
WHERE equity.account_code = 'EK'
    AND equity.year = 2024
ORDER BY equity_ratio_pct DESC NULLS LAST;

-- ============================================================================
-- 4. TREND ANALYSIS
-- ============================================================================

-- Year-over-year revenue growth
WITH revenue_by_year AS (
    SELECT 
        orgnr,
        year,
        amount_sek as revenue_sek
    FROM financial_accounts
    WHERE account_code = 'SDI'
        AND orgnr = '556123-4567'
)
SELECT 
    curr.orgnr,
    curr.year,
    curr.revenue_sek,
    prev.revenue_sek as prev_year_revenue,
    CASE 
        WHEN prev.revenue_sek > 0 
        THEN ((curr.revenue_sek - prev.revenue_sek) / prev.revenue_sek) * 100 
        ELSE NULL 
    END as yoy_growth_pct
FROM revenue_by_year curr
LEFT JOIN revenue_by_year prev 
    ON prev.orgnr = curr.orgnr 
    AND prev.year = curr.year - 1
ORDER BY curr.year DESC;

-- Multi-year trend for multiple metrics
SELECT 
    fa.year,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) as equity
FROM financial_accounts fa
WHERE fa.orgnr = '556123-4567'
    AND fa.year >= 2020
GROUP BY fa.year
ORDER BY fa.year;

-- ============================================================================
-- 5. COMPARATIVE ANALYSIS
-- ============================================================================

-- Find companies with high EBIT margins in same industry
SELECT 
    fa.orgnr,
    c.company_name,
    revenue.amount_sek as revenue_sek,
    ebit.amount_sek as ebit_sek,
    CASE 
        WHEN revenue.amount_sek > 0 
        THEN (ebit.amount_sek / revenue.amount_sek) * 100 
        ELSE NULL 
    END as ebit_margin_pct
FROM financial_accounts ebit
JOIN financial_accounts revenue 
    ON revenue.financial_id = ebit.financial_id 
    AND revenue.account_code = 'SDI'
JOIN companies c ON c.orgnr = ebit.orgnr
WHERE ebit.account_code = 'RG'
    AND ebit.year = 2024
    AND revenue.amount_sek > 10000000  -- Revenue > 10M SEK
    AND (ebit.amount_sek / NULLIF(revenue.amount_sek, 0)) * 100 > 10  -- Margin > 10%
ORDER BY ebit_margin_pct DESC
LIMIT 20;

-- Industry average metrics
SELECT 
    fa.account_code,
    COUNT(DISTINCT fa.orgnr) as company_count,
    AVG(fa.amount_sek) as avg_amount_sek,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fa.amount_sek) as median_amount_sek,
    MIN(fa.amount_sek) as min_amount_sek,
    MAX(fa.amount_sek) as max_amount_sek
FROM financial_accounts fa
WHERE fa.year = 2024
    AND fa.account_code IN ('SDI', 'RG', 'DR', 'EK')
GROUP BY fa.account_code
ORDER BY fa.account_code;

-- ============================================================================
-- 6. FILTERING AND SEARCH
-- ============================================================================

-- Find companies with specific financial characteristics
SELECT DISTINCT
    fa.orgnr,
    c.company_name,
    revenue.amount_sek as revenue_sek,
    equity.amount_sek as equity_sek,
    CASE 
        WHEN assets.amount_sek > 0 
        THEN (equity.amount_sek / assets.amount_sek) * 100 
        ELSE NULL 
    END as equity_ratio_pct
FROM financial_accounts equity
JOIN financial_accounts revenue 
    ON revenue.financial_id = equity.financial_id 
    AND revenue.account_code = 'SDI'
JOIN financial_accounts assets 
    ON assets.financial_id = equity.financial_id 
    AND assets.account_code = 'SV'
JOIN companies c ON c.orgnr = equity.orgnr
WHERE equity.account_code = 'EK'
    AND equity.year = 2024
    AND revenue.amount_sek BETWEEN 50000000 AND 500000000  -- Revenue 50M-500M SEK
    AND equity.amount_sek > 0  -- Positive equity
    AND (equity.amount_sek / NULLIF(assets.amount_sek, 0)) * 100 > 30  -- Equity ratio > 30%
ORDER BY revenue.amount_sek DESC;

-- ============================================================================
-- 7. AGGREGATIONS FOR AI ANALYSIS
-- ============================================================================

-- Calculate multiple ratios for AI analysis input
SELECT 
    fa.orgnr,
    fa.year,
    -- Revenue and profitability
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit_sek,
    -- Calculate margins
    CASE 
        WHEN MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) > 0
        THEN (MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) / 
              MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END)) * 100
        ELSE NULL
    END as ebit_margin_pct,
    CASE 
        WHEN MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) > 0
        THEN (MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) / 
              MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END)) * 100
        ELSE NULL
    END as net_margin_pct,
    -- Balance sheet
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) as equity_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) as total_assets_sek,
    -- Calculate equity ratio
    CASE 
        WHEN MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) > 0
        THEN (MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) / 
              MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END)) * 100
        ELSE NULL
    END as equity_ratio_pct
FROM financial_accounts fa
WHERE fa.orgnr = '556123-4567'
GROUP BY fa.orgnr, fa.year
ORDER BY fa.year DESC;

-- ============================================================================
-- 8. USING THE PIVOT VIEW
-- ============================================================================

-- Simple query using the pivot view
SELECT *
FROM financial_accounts_pivot
WHERE orgnr = '556123-4567'
ORDER BY year DESC;

-- Filter companies using pivot view
SELECT 
    fap.orgnr,
    c.company_name,
    fap.year,
    fap.revenue_sek,
    fap.ebit_sek,
    CASE 
        WHEN fap.revenue_sek > 0 
        THEN (fap.ebit_sek / fap.revenue_sek) * 100 
        ELSE NULL 
    END as ebit_margin_pct
FROM financial_accounts_pivot fap
JOIN companies c ON c.orgnr = fap.orgnr
WHERE fap.year = 2024
    AND fap.revenue_sek > 10000000
ORDER BY ebit_margin_pct DESC NULLS LAST;

