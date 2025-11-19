-- SQLite examples for querying normalized financial accounts data locally
-- These queries mirror database/financial_accounts_query_examples.sql but are
-- adapted for SQLite syntax and functions.

-- 1. Basic account lookup for a company/year
SELECT account_code, amount_sek, period
FROM financial_accounts
WHERE orgnr = '556123-4567' AND year = 2024
ORDER BY account_code;

-- 2. Pivot metrics for AI analysis (per company/year)
SELECT
    fa.orgnr,
    fa.year,
    fa.period,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) AS revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) AS ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) AS profit_sek,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) AS equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) AS debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) AS total_assets_sek,
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) AS employees
FROM financial_accounts fa
WHERE fa.orgnr = '556123-4567'
GROUP BY fa.orgnr, fa.year, fa.period
ORDER BY fa.year DESC, fa.period DESC;

-- 3. EBIT margin calculation (EBIT / Revenue)
SELECT
    ebit.orgnr,
    ebit.year,
    revenue.amount_sek AS revenue_sek,
    ebit.amount_sek AS ebit_sek,
    CASE
        WHEN revenue.amount_sek IS NOT NULL AND revenue.amount_sek != 0
        THEN (ebit.amount_sek / revenue.amount_sek) * 100
        ELSE NULL
    END AS ebit_margin_pct
FROM financial_accounts ebit
JOIN financial_accounts revenue
  ON revenue.financial_id = ebit.financial_id AND revenue.account_code = 'SDI'
WHERE ebit.account_code = 'RG' AND ebit.year = 2024
ORDER BY ebit_margin_pct DESC;

-- 4. Equity ratio (Equity / Total Assets)
SELECT
    equity.orgnr,
    equity.year,
    equity.amount_sek AS equity_sek,
    assets.amount_sek AS total_assets_sek,
    CASE
        WHEN assets.amount_sek IS NOT NULL AND assets.amount_sek != 0
        THEN (equity.amount_sek / assets.amount_sek) * 100
        ELSE NULL
    END AS equity_ratio_pct
FROM financial_accounts equity
JOIN financial_accounts assets
  ON assets.financial_id = equity.financial_id AND assets.account_code = 'SV'
WHERE equity.account_code = 'EK' AND equity.year = 2024
ORDER BY equity_ratio_pct DESC;

-- 5. Year-over-year revenue growth for a company
WITH revenue_per_year AS (
    SELECT year, amount_sek AS revenue
    FROM financial_accounts
    WHERE orgnr = '556123-4567' AND account_code = 'SDI'
)
SELECT
    curr.year,
    curr.revenue,
    prev.revenue AS prev_year_revenue,
    CASE
        WHEN prev.revenue IS NOT NULL AND prev.revenue != 0
        THEN ((curr.revenue - prev.revenue) / prev.revenue) * 100
        ELSE NULL
    END AS yoy_growth_pct
FROM revenue_per_year curr
LEFT JOIN revenue_per_year prev ON prev.year = curr.year - 1
ORDER BY curr.year;

-- 6. Industry comparison (example filters)
SELECT
    fa.orgnr,
    fa.year,
    rev.amount_sek AS revenue_sek,
    ebit.amount_sek AS ebit_sek,
    (ebit.amount_sek / rev.amount_sek) * 100 AS ebit_margin_pct
FROM financial_accounts ebit
JOIN financial_accounts rev
  ON rev.financial_id = ebit.financial_id AND rev.account_code = 'SDI'
JOIN companies c ON c.orgnr = ebit.orgnr
WHERE ebit.account_code = 'RG'
  AND ebit.year = 2024
  AND rev.amount_sek BETWEEN 50000000 AND 500000000
ORDER BY ebit_margin_pct DESC
LIMIT 20;

-- 7. Using the pivot view for convenience
SELECT *
FROM financial_accounts_pivot
WHERE orgnr = '556123-4567'
ORDER BY year DESC, period DESC;

