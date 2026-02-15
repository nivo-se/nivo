# Step 4: Create Tables in Supabase

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/clysgodrmowieximfaab
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `database/new_schema.sql`
5. Click **Run** (or press Cmd+Enter)

## Option 2: Via psql (if you have connection string)

If you have the PostgreSQL connection string (`SUPABASE_DB_URL`), you can run:

```bash
export SUPABASE_DB_URL="postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
psql "$SUPABASE_DB_URL" -f database/new_schema.sql
```

## Verify Tables Created

After running the SQL, verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('companies', 'company_financials', 'company_metrics');
```

Expected output: 3 rows (companies, company_financials, company_metrics)

