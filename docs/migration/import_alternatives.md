# Alternative Methods to Import Data into Supabase

Since direct `psql` connection is blocked, here are alternative methods:

## Option 1: Supabase Dashboard Table Editor (Easiest)

1. Go to: https://supabase.com/dashboard/project/clysgodrmowieximfaab/editor
2. For each table (`companies`, `company_financials`, `company_metrics`):
   - Click on the table name
   - Click "Insert" → "Import data from CSV"
   - Upload the corresponding CSV file from `data/csv_export/`
   - **Note**: For `company_financials.csv` (959MB), you may need to split it or use Option 2

## Option 2: Supabase Dashboard SQL Editor with COPY

1. Go to: https://supabase.com/dashboard/project/clysgodrmowieximfaab/sql/new
2. Upload the CSV files to Supabase Storage first
3. Then use COPY commands (requires files in storage)

## Option 3: Get Exact Connection String

The connection string format might be different. Check:
- Supabase Dashboard → Project Settings → Database → Connection string
- Copy the **exact** URI (not the template)
- It might use a different hostname or port

## Option 4: Use Supabase Client Library (Python/Node)

We can create a script using the Supabase client library which handles connections differently.

## Current Status

- ✅ Tables created
- ✅ CSVs generated (959MB financials, cleaned JSON)
- ⏳ Data loading blocked by network/firewall

**Recommended**: Try Option 1 (Table Editor) for `companies.csv` and `company_metrics.csv` first, then we'll handle the large `company_financials.csv` file.

