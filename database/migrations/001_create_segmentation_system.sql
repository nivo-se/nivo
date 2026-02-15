-- ============================================================================
-- Nivo Segmentation System
-- ============================================================================
-- Creates metrics view/table and scoring system for Tier A/B segmentation
-- ============================================================================

-- Step 1: Create materialized view for company segment metrics
-- This aggregates historical financials into per-company metrics needed for scoring

CREATE MATERIALIZED VIEW IF NOT EXISTS public.company_segment_metrics AS
WITH latest_financials AS (
    -- Get latest year's financial data per company
    -- Use SDI (account_codes) for revenue as it contains correct values in thousands
    SELECT DISTINCT ON (orgnr)
        orgnr,
        year as latest_year,
        (account_codes->>'SDI')::numeric as revenue_last_year,  -- SDI is revenue, stored in SEK (divide by 1M for MSEK)
        ebitda_sek,
        employees,
        equity_sek,
        (account_codes->>'SV')::numeric as total_assets_sek
    FROM public.company_financials
    WHERE account_codes->>'SDI' IS NOT NULL
    ORDER BY orgnr, year DESC, period DESC
),
revenue_growth AS (
    -- Calculate 3-year CAGR for revenue using SDI
    SELECT 
        cf1.orgnr,
        CASE 
            WHEN (cf3.account_codes->>'SDI')::numeric IS NOT NULL AND (cf3.account_codes->>'SDI')::numeric > 0 THEN
                POWER((cf1.account_codes->>'SDI')::numeric / NULLIF((cf3.account_codes->>'SDI')::numeric, 0), 1.0/2.0) - 1.0
            ELSE NULL
        END as revenue_3y_cagr
    FROM public.company_financials cf1
    LEFT JOIN public.company_financials cf3 ON 
        cf1.orgnr = cf3.orgnr 
        AND cf3.year = cf1.year - 2
    WHERE cf1.year = (SELECT MAX(year) FROM public.company_financials WHERE orgnr = cf1.orgnr)
        AND cf1.account_codes->>'SDI' IS NOT NULL
),
ebitda_margins AS (
    -- Calculate EBITDA margins for latest year and 3-year average using SDI for revenue
    SELECT 
        cf.orgnr,
        -- Latest year EBITDA margin (using SDI for revenue)
        CASE 
            WHEN (latest.account_codes->>'SDI')::numeric > 0 THEN 
                (latest.ebitda_sek::numeric / (latest.account_codes->>'SDI')::numeric) * 100
            ELSE NULL
        END as ebitda_margin_last_year,
        -- 3-year average EBITDA margin
        CASE 
            WHEN COUNT(*) >= 3 AND SUM((cf.account_codes->>'SDI')::numeric) > 0 THEN
                (SUM(cf.ebitda_sek)::numeric / SUM((cf.account_codes->>'SDI')::numeric)) * 100
            ELSE NULL
        END as ebitda_margin_3y_avg
    FROM public.company_financials cf
    INNER JOIN (
        SELECT DISTINCT ON (orgnr) orgnr, account_codes, ebitda_sek
        FROM public.company_financials
        WHERE account_codes->>'SDI' IS NOT NULL AND ebitda_sek IS NOT NULL
        ORDER BY orgnr, year DESC
    ) latest ON cf.orgnr = latest.orgnr
    WHERE cf.year >= (SELECT MAX(year) - 2 FROM public.company_financials cf2 WHERE cf2.orgnr = cf.orgnr)
    AND cf.account_codes->>'SDI' IS NOT NULL
    AND cf.ebitda_sek IS NOT NULL
    GROUP BY cf.orgnr, latest.account_codes, latest.ebitda_sek
),
equity_ratios AS (
    -- Calculate equity ratio (equity / total assets) for latest year
    SELECT 
        orgnr,
        CASE 
            WHEN (account_codes->>'SV')::numeric > 0 THEN
                (equity_sek::numeric / (account_codes->>'SV')::numeric) * 100
            ELSE NULL
        END as equity_ratio_last_year
    FROM public.company_financials
    WHERE year = (SELECT MAX(year) FROM public.company_financials cf2 WHERE cf2.orgnr = company_financials.orgnr)
    AND equity_sek IS NOT NULL
    AND (account_codes->>'SV')::numeric > 0
)
SELECT DISTINCT ON (c.orgnr)
    c.orgnr,
    lf.latest_year,
    lf.revenue_last_year,
    rg.revenue_3y_cagr * 100 as revenue_3y_cagr,  -- Convert to percentage
    em.ebitda_margin_last_year,
    em.ebitda_margin_3y_avg,
    lf.employees as employees_last_year,
    er.equity_ratio_last_year
FROM public.companies c
LEFT JOIN latest_financials lf ON c.orgnr = lf.orgnr
LEFT JOIN revenue_growth rg ON c.orgnr = rg.orgnr
LEFT JOIN ebitda_margins em ON c.orgnr = em.orgnr
LEFT JOIN equity_ratios er ON c.orgnr = er.orgnr
ORDER BY c.orgnr, lf.latest_year DESC NULLS LAST;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS company_segment_metrics_orgnr_idx 
    ON public.company_segment_metrics(orgnr);

-- Step 2: Add scoring columns to company_metrics table
-- (We'll use company_metrics as the base table for scoring)

ALTER TABLE public.company_metrics 
ADD COLUMN IF NOT EXISTS fit_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ops_upside_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS nivo_total_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS segment_tier text NULL;

-- Step 3: Create function to calculate and update scores
CREATE OR REPLACE FUNCTION public.calculate_segmentation_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    v_size_score integer;
    v_profitability_score integer;
    v_stability_score integer;
    v_margin_headroom_score integer;
    v_margin_trend_score integer;
    v_growth_vs_margin_score integer;
    v_fit_score integer;
    v_ops_upside_score integer;
    v_nivo_total_score integer;
    v_segment_tier_val text;
BEGIN
    -- Clear existing scores
    UPDATE public.company_metrics 
    SET fit_score = 0, ops_upside_score = 0, nivo_total_score = 0, segment_tier = NULL;
    
    -- Calculate scores for each company
    FOR rec IN 
        SELECT 
            csm.orgnr,
            csm.revenue_last_year,
            csm.revenue_3y_cagr,
            csm.ebitda_margin_last_year,
            csm.ebitda_margin_3y_avg,
            csm.equity_ratio_last_year
        FROM public.company_segment_metrics csm
    LOOP
        -- Initialize scores
        v_size_score := 0;
        v_profitability_score := 0;
        v_stability_score := 0;
        v_margin_headroom_score := 0;
        v_margin_trend_score := 0;
        v_growth_vs_margin_score := 0;
        
        -- FIT SCORE CALCULATION
        
        -- Size score (0-40 points) - Continuous scoring based on revenue
        -- Revenue (SDI) is stored in SEK, range is 50-200 MSEK (50M-200M SEK)
        -- Sweet spot: 70-150 MSEK gets highest scores
        IF rec.revenue_last_year IS NOT NULL THEN
            -- Convert to MSEK (divide by 1,000,000 since SDI is in SEK)
            DECLARE
                revenue_msek numeric := rec.revenue_last_year / 1000000.0;
            BEGIN
                -- Continuous scoring: peak at 100 MSEK (middle of sweet spot)
                IF revenue_msek >= 70 AND revenue_msek <= 150 THEN
                    -- Sweet spot: 70-150 MSEK gets 30-40 points (linear)
                    v_size_score := 30 + ROUND(10.0 * (revenue_msek - 70.0) / 80.0);
                ELSIF revenue_msek >= 50 AND revenue_msek < 70 THEN
                    -- Lower range: 50-70 MSEK gets 20-30 points
                    v_size_score := 20 + ROUND(10.0 * (revenue_msek - 50.0) / 20.0);
                ELSIF revenue_msek > 150 AND revenue_msek <= 200 THEN
                    -- Upper range: 150-200 MSEK gets 30-35 points (slight penalty)
                    v_size_score := 30 + ROUND(5.0 * (200.0 - revenue_msek) / 50.0);
                ELSIF revenue_msek < 50 THEN
                    -- Below minimum: linear penalty
                    v_size_score := GREATEST(0, ROUND(20.0 * revenue_msek / 50.0));
                ELSE
                    -- Above maximum: penalty
                    v_size_score := GREATEST(0, ROUND(30.0 * (250.0 - revenue_msek) / 50.0));
                END IF;
            END;
        ELSE
            v_size_score := 0;
        END IF;
        
        -- Profitability level score (0-30 points) - Continuous scoring
        -- Optimal range: 5-15% gets highest scores, with penalties for extremes
        IF rec.ebitda_margin_last_year IS NOT NULL THEN
            DECLARE
                margin numeric := rec.ebitda_margin_last_year;
            BEGIN
                IF margin >= 5 AND margin <= 15 THEN
                    -- Sweet spot: 5-15% gets 25-30 points (peak at 10%)
                    v_profitability_score := 25 + ROUND(5 * (1 - ABS(margin - 10) / 5));
                ELSIF margin >= 0 AND margin < 5 THEN
                    -- Low margin: 0-5% gets 10-25 points (linear)
                    v_profitability_score := 10 + ROUND(15 * margin / 5);
                ELSIF margin > 15 AND margin <= 25 THEN
                    -- High margin: 15-25% gets 20-25 points (slight penalty)
                    v_profitability_score := 20 + ROUND(5 * (25 - margin) / 10);
                ELSIF margin < 0 THEN
                    -- Negative margin: penalty
                    v_profitability_score := GREATEST(0, ROUND(10 * (1 + margin / 10)));
                ELSE
                    -- Very high margin (>25%): penalty (may indicate data issues or exceptional cases)
                    v_profitability_score := GREATEST(0, ROUND(20 * (35 - margin) / 10));
                END IF;
            END;
        ELSE
            v_profitability_score := 0;
        END IF;
        
        -- Stability score (0-30 points) - More granular scoring
        -- Growth component (0-15 points)
        IF rec.revenue_3y_cagr IS NOT NULL THEN
            DECLARE
                growth_pct numeric := rec.revenue_3y_cagr;
            BEGIN
                IF growth_pct >= 2 AND growth_pct <= 15 THEN
                    -- Optimal growth: 2-15% gets 10-15 points (peak at 8.5%)
                    v_stability_score := v_stability_score + 10 + ROUND(5 * (1 - ABS(growth_pct - 8.5) / 6.5));
                ELSIF growth_pct > 15 AND growth_pct <= 30 THEN
                    -- High growth: 15-30% gets 8-10 points (slight penalty for volatility risk)
                    v_stability_score := v_stability_score + 8 + ROUND(2 * (30 - growth_pct) / 15);
                ELSIF growth_pct >= -5 AND growth_pct < 2 THEN
                    -- Low/negative growth: -5% to 2% gets 5-10 points
                    v_stability_score := v_stability_score + 5 + ROUND(5 * (growth_pct + 5) / 7);
                ELSIF growth_pct < -5 THEN
                    -- Declining: penalty
                    v_stability_score := v_stability_score + GREATEST(0, ROUND(5 * (1 + growth_pct / 10)));
                ELSE
                    -- Very high growth (>30%): penalty (may indicate volatility)
                    v_stability_score := v_stability_score + GREATEST(0, ROUND(8 * (50 - growth_pct) / 20));
                END IF;
            END;
        END IF;
        
        -- Equity ratio component (0-15 points)
        IF rec.equity_ratio_last_year IS NOT NULL THEN
            DECLARE
                equity_ratio numeric := rec.equity_ratio_last_year;
            BEGIN
                IF equity_ratio >= 25 AND equity_ratio <= 60 THEN
                    -- Good equity ratio: 25-60% gets 12-15 points (peak at 40%)
                    v_stability_score := v_stability_score + 12 + ROUND(3 * (1 - ABS(equity_ratio - 40) / 20));
                ELSIF equity_ratio > 60 AND equity_ratio <= 80 THEN
                    -- Very high equity: 60-80% gets 10-12 points (may indicate under-leverage)
                    v_stability_score := v_stability_score + 10 + ROUND(2 * (80 - equity_ratio) / 20);
                ELSIF equity_ratio >= 10 AND equity_ratio < 25 THEN
                    -- Low equity: 10-25% gets 5-12 points (linear)
                    v_stability_score := v_stability_score + 5 + ROUND(7 * (equity_ratio - 10) / 15);
                ELSIF equity_ratio < 10 THEN
                    -- Very low equity: penalty
                    v_stability_score := v_stability_score + GREATEST(0, ROUND(5 * equity_ratio / 10));
                ELSE
                    -- Extremely high equity (>80%): slight penalty
                    v_stability_score := v_stability_score + GREATEST(0, ROUND(10 * (100 - equity_ratio) / 20));
                END IF;
            END;
        END IF;
        
        -- Cap v_stability_score at 30
        IF v_stability_score > 30 THEN
            v_stability_score := 30;
        END IF;
        
        v_fit_score := v_size_score + v_profitability_score + v_stability_score;
        IF v_fit_score > 100 THEN
            v_fit_score := 100;
        END IF;
        
        -- OPS UPSIDE SCORE CALCULATION
        
        -- Margin headroom score (0-50 points)
        IF rec.ebitda_margin_last_year IS NOT NULL THEN
            IF rec.ebitda_margin_last_year >= 3 AND rec.ebitda_margin_last_year <= 12 THEN
                v_margin_headroom_score := 50;
            ELSIF rec.ebitda_margin_last_year >= 0 AND rec.ebitda_margin_last_year < 3 THEN
                v_margin_headroom_score := 30;
            ELSIF rec.ebitda_margin_last_year > 12 AND rec.ebitda_margin_last_year <= 18 THEN
                v_margin_headroom_score := 20;
            ELSE
                v_margin_headroom_score := 0;
            END IF;
        END IF;
        
        -- Margin trend score (0-25 points)
        IF rec.ebitda_margin_last_year IS NOT NULL AND rec.ebitda_margin_3y_avg IS NOT NULL THEN
            IF rec.ebitda_margin_last_year <= rec.ebitda_margin_3y_avg THEN
                v_margin_trend_score := 25;
            ELSIF (rec.ebitda_margin_last_year - rec.ebitda_margin_3y_avg) > 0 AND 
                  (rec.ebitda_margin_last_year - rec.ebitda_margin_3y_avg) <= 3 THEN
                v_margin_trend_score := 10;
            ELSE
                v_margin_trend_score := 0;
            END IF;
        END IF;
        
        -- Growth vs margin score (0-25 points)
        IF rec.revenue_3y_cagr IS NOT NULL AND rec.ebitda_margin_last_year IS NOT NULL THEN
            IF rec.revenue_3y_cagr > 5 AND rec.ebitda_margin_last_year < 15 THEN
                v_growth_vs_margin_score := 25;
            ELSIF rec.revenue_3y_cagr >= 0 AND rec.revenue_3y_cagr <= 5 AND 
                  rec.ebitda_margin_last_year >= 3 AND rec.ebitda_margin_last_year <= 15 THEN
                v_growth_vs_margin_score := 10;
            ELSE
                v_growth_vs_margin_score := 0;
            END IF;
        END IF;
        
        v_ops_upside_score := v_margin_headroom_score + v_margin_trend_score + v_growth_vs_margin_score;
        IF v_ops_upside_score > 100 THEN
            v_ops_upside_score := 100;
        END IF;
        
        -- Calculate total score
        v_nivo_total_score := v_fit_score + v_ops_upside_score;
        
        -- Update company_metrics with scores (tier will be assigned after ranking)
        UPDATE public.company_metrics cm
        SET 
            fit_score = v_fit_score,
            ops_upside_score = v_ops_upside_score,
            nivo_total_score = v_nivo_total_score,
            segment_tier = NULL  -- Reset tier, will be assigned based on ranking
        WHERE cm.orgnr = rec.orgnr;
        
    END LOOP;
    
    -- Assign tiers based on ranking (after all scores calculated)
    -- Tier 1: Top 100 companies (rank 1-100)
    UPDATE public.company_metrics cm
    SET segment_tier = '1'
    WHERE cm.orgnr IN (
        SELECT orgnr
        FROM public.company_metrics
        WHERE fit_score IS NOT NULL
        ORDER BY fit_score DESC, nivo_total_score DESC, ops_upside_score DESC
        LIMIT 100
    );
    
    -- Tier 2: Next 100 companies (rank 101-200)
    UPDATE public.company_metrics cm
    SET segment_tier = '2'
    WHERE cm.orgnr IN (
        SELECT orgnr
        FROM public.company_metrics
        WHERE fit_score IS NOT NULL AND segment_tier IS NULL
        ORDER BY fit_score DESC, nivo_total_score DESC, ops_upside_score DESC
        LIMIT 100
    );
    
    -- Tier 3: Next 100 companies (rank 201-300)
    UPDATE public.company_metrics cm
    SET segment_tier = '3'
    WHERE cm.orgnr IN (
        SELECT orgnr
        FROM public.company_metrics
        WHERE fit_score IS NOT NULL AND segment_tier IS NULL
        ORDER BY fit_score DESC, nivo_total_score DESC, ops_upside_score DESC
        LIMIT 100
    );
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.company_segment_metrics;
END;
$$;

-- Step 4: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_company_metrics_segment_tier 
    ON public.company_metrics(segment_tier) 
    WHERE segment_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_metrics_nivo_total_score 
    ON public.company_metrics(nivo_total_score DESC);

-- Step 5: Initial population
-- Note: This will be called after data migration
-- SELECT public.calculate_segmentation_scores();

COMMENT ON MATERIALIZED VIEW public.company_segment_metrics IS 
'Aggregated metrics per company for segmentation scoring. Includes revenue, growth, margins, and equity ratios.';

COMMENT ON FUNCTION public.calculate_segmentation_scores() IS 
'Calculates fit_score, ops_upside_score, nivo_total_score, and segment_tier for all companies based on financial metrics.';

COMMENT ON COLUMN public.company_metrics.fit_score IS 
'Fit score (0-100): Size (0-40) + Profitability (0-30) + Stability (0-30). Measures how well company fits acquisition criteria.';

COMMENT ON COLUMN public.company_metrics.ops_upside_score IS 
'Ops upside score (0-100): Margin headroom (0-50) + Margin trend (0-25) + Growth vs margin (0-25). Measures operational improvement potential.';

COMMENT ON COLUMN public.company_metrics.nivo_total_score IS 
'Total score (0-200): fit_score + ops_upside_score. Higher is better.';

COMMENT ON COLUMN public.company_metrics.segment_tier IS 
'Segment tier: A (fit>=60, ops>=60, total>=140), B (fit>=50, ops>=50, total>=120), or NULL.';

