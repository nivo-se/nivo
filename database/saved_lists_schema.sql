-- Schema for saved company lists
-- Run this in Supabase SQL Editor

-- Table for saved company lists
CREATE TABLE IF NOT EXISTS saved_company_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    companies JSONB NOT NULL DEFAULT '[]'::jsonb,
    filters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_company_lists_user_id ON saved_company_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_company_lists_created_at ON saved_company_lists(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE saved_company_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own lists
CREATE POLICY "Users can view own lists" ON saved_company_lists
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own lists
CREATE POLICY "Users can insert own lists" ON saved_company_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own lists
CREATE POLICY "Users can update own lists" ON saved_company_lists
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own lists
CREATE POLICY "Users can delete own lists" ON saved_company_lists
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_saved_company_lists_updated_at 
    BEFORE UPDATE ON saved_company_lists 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
