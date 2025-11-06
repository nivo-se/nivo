-- Load data via Supabase Dashboard SQL Editor
-- Copy and paste these commands one at a time in the SQL Editor
-- https://supabase.com/dashboard/project/clysgodrmowieximfaab/sql/new

-- Step 1: Load companies (must be first due to foreign key constraints)
\copy companies FROM '/path/to/data/csv_export/companies.csv' WITH CSV HEADER;

-- Note: The above won't work directly in the dashboard because \copy requires local file access.
-- Instead, use the Supabase Dashboard Table Editor to import:
-- 1. Go to Table Editor → companies table
-- 2. Click "Insert" → "Import data from CSV"
-- 3. Upload companies.csv

-- OR use the REST API or create a function to load the data.

-- Alternative: Use COPY FROM STDIN (paste CSV data)
-- This requires the CSV data to be pasted, which is impractical for large files.

-- Recommended: Use the Supabase Dashboard Table Editor Import feature
-- Or use the Python script with proper connection string

