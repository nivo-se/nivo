-- Fix Row-Level Security policies for saved_company_lists table
-- This allows the API to create, read, update, and delete saved lists

-- First, let's check if the table exists and its current RLS status
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'saved_company_lists';

-- Enable RLS if not already enabled (this should already be enabled)
ALTER TABLE saved_company_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can access their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can create their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can update their own saved lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can delete their own saved lists" ON saved_company_lists;

-- Create policies that allow access for the default user ID we're using
-- For now, we'll use a permissive policy that allows all operations for our mock user

-- Policy for SELECT (reading saved lists)
CREATE POLICY "Allow read access for default user" ON saved_company_lists
    FOR SELECT
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Policy for INSERT (creating saved lists)
CREATE POLICY "Allow insert access for default user" ON saved_company_lists
    FOR INSERT
    WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Policy for UPDATE (updating saved lists)
CREATE POLICY "Allow update access for default user" ON saved_company_lists
    FOR UPDATE
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
    WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Policy for DELETE (deleting saved lists)
CREATE POLICY "Allow delete access for default user" ON saved_company_lists
    FOR DELETE
    USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Alternative: If you want to allow all operations for now (less secure but simpler for development)
-- You can uncomment the following lines and comment out the above policies:

-- DROP POLICY IF EXISTS "Allow read access for default user" ON saved_company_lists;
-- DROP POLICY IF EXISTS "Allow insert access for default user" ON saved_company_lists;
-- DROP POLICY IF EXISTS "Allow update access for default user" ON saved_company_lists;
-- DROP POLICY IF EXISTS "Allow delete access for default user" ON saved_company_lists;

-- CREATE POLICY "Allow all operations for development" ON saved_company_lists
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'saved_company_lists';
