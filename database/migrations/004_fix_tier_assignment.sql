-- ============================================================================
-- Fix Tier Assignment to Use Ranking (Tier 1/2/3) Instead of Thresholds (A/B)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_segmentation_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    v_size_score numeric := 0;
    v_profitability_score numeric := 0;
    v_stability_score numeric := 0;
    v_fit_score numeric := 0;
    v_margin_headroom_score numeric := 0;
    v_margin_trend_score numeric := 0;
    v_growth_vs_margin_score numeric := 0;
    v_ops_upside_score numeric := 0;
    v_nivo_total_score numeric := 0;
BEGIN
    -- Loop through all companies in the segment metrics view
    FOR rec IN 
        SELECT * FROM public.company_segment_metrics
    LOOP
        -- Reset scores
        v_size_score := 0;
        v_profitability_score := 0;
        v_stability_score := 0;
        v_fit_score := 0;
        v_margin_headroom_score := 0;
        v_margin_trend_score := 0;
        v_growth_vs_margin_score := 0;
        v_ops_upside_score := 0;
        v_nivo_total_score := 0;
        
        -- SIZE SCORE (0-40 points) - Continuous scoring
        IF rec.revenue_last_year IS NOT NULL THEN
            DECLARE
                revenue_msek numeric := rec.revenue_last_year / 1000000.0;
            BEGIN
                IF revenue_msek >= 70 AND revenue_msek <= 150 THEN
                    -- Sweet spot: 70-150 MSEK gets highest scores (peak at 110 MSEK)
                    v_size_score := 35 + ROUND(5 * (1 - ABS(revenue_msek - 110) / 40));
                ELSIF revenue_msek >= 50 AND revenue_msek < 70 THEN
                    -- Below sweet spot: 50-70 MSEK gets 25-35 points (linear)
                    v_size_score := 25 + ROUND(10 * (revenue_msek - 50) / 20);
                ELSIF revenue_msek > 150 AND revenue_msek <= 200 THEN
                    -- Above sweet spot: 150-200 MSEK gets 30-35 points (linear decline)
                    v_size_score := 30 + ROUND(5 * (200 - revenue_msek) / 50);
                ELSIF revenue_msek < 50 THEN
                    -- Too small: penalty
                    v_size_score := GREATEST(0, ROUND(25 * revenue_msek / 50));
                ELSE
                    -- Too large (>200 MSEK): penalty
                    v_size_score := GREATEST(0, ROUND(30 * (250 - revenue_msek) / 50));
                END IF;
            END;
        END IF;
        
        -- PROFITABILITY SCORE (0-30 points) - Continuous scoring
        IF rec.ebitda_margin_last_year IS NOT NULL THEN
            DECLARE
                margin numeric := rec.ebitda_margin_last_year;
            BEGIN
                IF margin >= 5 AND margin <= 15 THEN
                    -- Optimal range: 5-15% gets highest scores (peak at 10%)
                    v_profitability_score := 25 + ROUND(5 * (1 - ABS(margin - 10) / 5));
                ELSIF margin >= 3 AND margin < 5 THEN
                    -- Good margin: 3-5% gets 20-25 points (linear)
                    v_profitability_score := 20 + ROUND(5 * (margin - 3) / 2);
                ELSIF margin > 15 AND margin <= 25 THEN
                    -- High margin: 15-25% gets 20-25 points (slight decline)
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





