-- Delete Old Tables Script
-- ⚠️  WARNING: This script will DELETE old tables from Supabase
-- ⚠️  Review carefully and confirm before executing
-- ⚠️  This script should only be run AFTER successful migration of all new data

-- Tables to DELETE (old schema):
-- These tables are replaced by the new schema (companies, company_financials, financial_accounts, company_metrics)

-- 1. Old master analytics table
DROP TABLE IF EXISTS public.master_analytics CASCADE;

-- 2. Old company accounts table
DROP TABLE IF EXISTS public.company_accounts_by_id CASCADE;

-- 3. Old company KPIs table
DROP TABLE IF EXISTS public.company_kpis_by_id CASCADE;

-- 4. Old enriched companies table
DROP TABLE IF EXISTS public.companies_enriched CASCADE;

-- 5. Old companies table (if it exists with old schema)
-- NOTE: Only drop if it has the old schema (check column names first)
-- If the new companies table exists, this should fail safely
-- DROP TABLE IF EXISTS public.companies CASCADE;  -- COMMENTED OUT - Keep new companies table

-- 6. Old filtered/versioned tables (if they exist)
DROP TABLE IF EXISTS public.filtered_companies_basic_filters_20250618_104041 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_basic_filters_20250618_104154 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_basic_filters_20250618_104214 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_basic_filters_20250618_104409 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_basic_filters_20250618_104425 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_v20250528_095611 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_v20250528_102534 CASCADE;
DROP TABLE IF EXISTS public.filtered_companies_v20250528_103211 CASCADE;
DROP TABLE IF EXISTS public.filtered_candidates CASCADE;
DROP TABLE IF EXISTS public.final_filter_companies CASCADE;

-- 7. Old e-commerce tables (if they exist)
DROP TABLE IF EXISTS public.digitizable_ecommerce_and_product_companies CASCADE;
DROP TABLE IF EXISTS public.digitizable_ecommerce_and_product_companies_backup CASCADE;

-- 8. Old all_companies_raw table (if it exists)
DROP TABLE IF EXISTS public.all_companies_raw CASCADE;

-- Tables to KEEP:
-- ✅ companies (new schema)
-- ✅ company_financials (new schema)
-- ✅ financial_accounts (new schema)
-- ✅ company_metrics (new schema)
-- ✅ ai_ops.* tables (AI analysis)
-- ✅ Valuation tables
-- ✅ saved_company_lists (user data)
-- ✅ user_roles (user management)

-- Verification queries (run these BEFORE executing the delete script):
-- SELECT COUNT(*) FROM public.companies;  -- Should be ~13,609
-- SELECT COUNT(*) FROM public.company_financials;  -- Should be ~66,614
-- SELECT COUNT(*) FROM public.financial_accounts;  -- Should be ~3,314,236
-- SELECT COUNT(*) FROM public.company_metrics;  -- Should be ~13,609

-- After deletion, verify old tables are gone:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('master_analytics', 'company_accounts_by_id', 'company_kpis_by_id', 'companies_enriched');

