-- Check if Auth tables still exist
-- Auth tables should be in the 'auth' schema, not 'public'

-- ============================================
-- 1. Check if auth schema exists
-- ============================================
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- ============================================
-- 2. List all tables in auth schema
-- ============================================
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('auth.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY tablename;

-- ============================================
-- 3. Check all schemas to see what exists
-- ============================================
SELECT 
    schemaname,
    COUNT(*) AS table_count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
GROUP BY schemaname
ORDER BY schemaname;

-- ============================================
-- 4. Check if auth.users table exists and has data
-- ============================================
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS auth_users_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
        THEN (SELECT COUNT(*) FROM auth.users)
        ELSE 0
    END AS user_count;

