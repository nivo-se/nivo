-- Temporarily allow INSERT/UPDATE for migration
-- Run this in Supabase SQL Editor BEFORE running the Python migration

-- Add policy to allow INSERT operations
CREATE POLICY "Allow insert during migration" ON master_analytics
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Add policy to allow UPDATE operations  
CREATE POLICY "Allow update during migration" ON master_analytics
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

-- To remove these policies AFTER migration is complete, run:
-- DROP POLICY IF EXISTS "Allow insert during migration" ON master_analytics;
-- DROP POLICY IF EXISTS "Allow update during migration" ON master_analytics;

