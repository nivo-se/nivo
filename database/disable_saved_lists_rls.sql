-- Disable Row-Level Security for saved_company_lists table (for development)
-- This is a simpler approach that allows all operations without authentication

-- Disable RLS on the table
ALTER TABLE saved_company_lists DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can access their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can create their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can update their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can delete their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Allow read access for default user" ON saved_company_lists;
DROP POLICY IF EXISTS "Allow insert access for default user" ON saved_company_lists;
DROP POLICY IF EXISTS "Allow update access for default user" ON saved_company_lists;
DROP POLICY IF EXISTS "Allow delete access for default user" ON saved_company_lists;
DROP POLICY IF EXISTS "Allow all operations for development" ON saved_company_lists;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'saved_company_lists';
