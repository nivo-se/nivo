# Manual Migration Guide - Supabase Dashboard

Since direct database connection is not available, use the Supabase Dashboard to migrate data.

## Prerequisites

✅ CSV files exported (already done):
- `data/csv_export/companies.csv` (5.5MB, 13,609 rows)
- `data/csv_export/company_financials.csv` (957MB, 66,614 rows)
- `data/csv_export/financial_accounts.csv` (407MB, 3,314,236 rows)
- `data/csv_export/company_metrics.csv` (3.2MB, 13,609 rows)

## Step-by-Step Migration

### Step 1: Delete Old Tables

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the contents of `scripts/truncate_supabase_tables.sql`
4. Click **Run** (or press Cmd+Enter)

This will delete:
- Old tables: master_analytics, company_accounts_by_id, company_kpis_by_id, etc.
- New tables: companies, company_financials, financial_accounts, company_metrics (if they exist)

### Step 2: Create New Schema

1. In SQL Editor, create a new query
2. Copy and paste the contents of `database/new_schema.sql`
3. Click **Run**

This creates:
- `companies` table
- `company_financials` table
- `company_metrics` table

4. Create another new query
5. Copy and paste the contents of `database/financial_accounts_schema.sql`
6. Click **Run**

This creates:
- `financial_accounts` table
- Indexes and constraints

### Step 3: Import CSV Data

For each CSV file, use Supabase Table Editor:

#### 3.1 Import Companies (smallest, start here)

1. Go to **Table Editor** → `companies` table
2. Click **Insert** → **Import data from CSV**
3. Upload `data/csv_export/companies.csv`
4. Map columns (should auto-detect)
5. Click **Import**

Expected: 13,609 rows

#### 3.2 Import Company Financials

1. Go to **Table Editor** → `company_financials` table
2. Click **Insert** → **Import data from CSV**
3. Upload `data/csv_export/company_financials.csv`
4. **Important**: Uncheck the `id` column (it will be auto-generated)
5. Map remaining columns
6. Click **Import**

Expected: 66,614 rows
⏱️ This may take 5-10 minutes

#### 3.3 Import Financial Accounts (largest)

1. Go to **Table Editor** → `financial_accounts` table
2. Click **Insert** → **Import data from CSV**
3. Upload `data/csv_export/financial_accounts.csv`
4. **Important**: Uncheck the `id` column (it will be auto-generated)
5. Map remaining columns:
   - `financial_id` → UUID (must match company_financials.id)
   - `orgnr` → text
   - `year` → integer
   - `period` → text
   - `account_code` → text
   - `amount_sek` → numeric
   - `created_at` → timestamp
6. Click **Import**

Expected: 3,314,236 rows
⏱️ This may take 15-30 minutes

#### 3.4 Import Company Metrics

1. Go to **Table Editor** → `company_metrics` table
2. Click **Insert** → **Import data from CSV**
3. Upload `data/csv_export/company_metrics.csv`
4. Map columns
5. Click **Import**

Expected: 13,609 rows

### Step 4: Verify Data

Run this query in SQL Editor:

```sql
SELECT 
    'companies' AS table_name, 
    COUNT(*) AS row_count,
    'Expected: 13,609' AS expected
FROM public.companies
UNION ALL
SELECT 
    'company_financials', 
    COUNT(*),
    'Expected: 66,614'
FROM public.company_financials
UNION ALL
SELECT 
    'financial_accounts', 
    COUNT(*),
    'Expected: 3,314,236'
FROM public.financial_accounts
UNION ALL
SELECT 
    'company_metrics', 
    COUNT(*),
    'Expected: 13,609'
FROM public.company_metrics
ORDER BY table_name;
```

All row counts should match expected values.

## Troubleshooting

### If CSV import fails:

1. **Check file size**: Supabase has limits on file uploads. For very large files (>100MB), you may need to:
   - Split the CSV into smaller chunks
   - Use Supabase CLI: `supabase db import`
   - Or use the Python script once DNS is fixed

2. **Check data types**: Ensure CSV columns match table schema types

3. **Check foreign keys**: 
   - `company_financials.orgnr` must exist in `companies.orgnr`
   - `financial_accounts.financial_id` must exist in `company_financials.id`
   - `company_metrics.orgnr` must exist in `companies.orgnr`

### Alternative: Use Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref clysgodrmowieximfaab

# Import CSV files
supabase db import data/csv_export/companies.csv --table companies
supabase db import data/csv_export/company_financials.csv --table company_financials
supabase db import data/csv_export/financial_accounts.csv --table financial_accounts
supabase db import data/csv_export/company_metrics.csv --table company_metrics
```

## Next Steps After Migration

1. ✅ Verify row counts match expected values
2. ✅ Test frontend - it should now use Supabase directly
3. ✅ Delete old tables (see `scripts/delete_old_tables.sql`)

