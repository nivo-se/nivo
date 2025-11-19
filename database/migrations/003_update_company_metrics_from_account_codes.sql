-- ============================================================================
-- Update company_metrics.latest_*_sek columns from account_codes
-- ============================================================================
-- Fixes the latest_*_sek columns to use correct source (account_codes)
-- ============================================================================

-- Update latest_revenue_sek from SDI
UPDATE public.company_metrics cm
SET latest_revenue_sek = (
    SELECT (account_codes->>'SDI')::numeric
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'SDI' IS NOT NULL
    ORDER BY cf.year DESC, cf.period DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'SDI' IS NOT NULL
);

-- Update latest_profit_sek from DR
UPDATE public.company_metrics cm
SET latest_profit_sek = (
    SELECT (account_codes->>'DR')::numeric
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'DR' IS NOT NULL
    ORDER BY cf.year DESC, cf.period DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'DR' IS NOT NULL
);

-- Update latest_ebitda_sek from EBITDA
UPDATE public.company_metrics cm
SET latest_ebitda_sek = (
    SELECT (account_codes->>'EBITDA')::numeric
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'EBITDA' IS NOT NULL
    ORDER BY cf.year DESC, cf.period DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.company_financials cf
    WHERE cf.orgnr = cm.orgnr
    AND account_codes->>'EBITDA' IS NOT NULL
);

-- Verify updates
DO $$
DECLARE
    revenue_count integer;
    profit_count integer;
    ebitda_count integer;
BEGIN
    SELECT COUNT(*) INTO revenue_count
    FROM company_metrics
    WHERE latest_revenue_sek IS NOT NULL;
    
    SELECT COUNT(*) INTO profit_count
    FROM company_metrics
    WHERE latest_profit_sek IS NOT NULL;
    
    SELECT COUNT(*) INTO ebitda_count
    FROM company_metrics
    WHERE latest_ebitda_sek IS NOT NULL;
    
    RAISE NOTICE 'Updated company_metrics:';
    RAISE NOTICE '  latest_revenue_sek: % companies', revenue_count;
    RAISE NOTICE '  latest_profit_sek: % companies', profit_count;
    RAISE NOTICE '  latest_ebitda_sek: % companies', ebitda_count;
END $$;

