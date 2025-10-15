-- Fix saved_company_lists table schema
-- Run this in Supabase SQL Editor to fix the user_id column type

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view own lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can insert own lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can update own lists" ON saved_company_lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON saved_company_lists;

-- Convert user_id from TEXT to UUID
-- This will fail if there are existing records with invalid UUIDs
-- If you have existing data, you may need to clean it up first
ALTER TABLE saved_company_lists 
ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Recreate policies with correct UUID comparison
CREATE POLICY "Users can view own lists" ON saved_company_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lists" ON saved_company_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists" ON saved_company_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists" ON saved_company_lists
    FOR DELETE USING (auth.uid() = user_id);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'saved_company_lists' 
ORDER BY ordinal_position;
