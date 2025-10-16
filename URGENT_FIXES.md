# URGENT FIXES NEEDED

## Issue 1: Database Schema Missing Columns

The new columns for template tracking don't exist in the database. **You need to run this SQL in your Supabase SQL editor:**

```sql
-- Add new columns to track analysis focus and template information
ALTER TABLE ai_ops.ai_analysis_runs 
ADD COLUMN IF NOT EXISTS analysis_template_id text,
ADD COLUMN IF NOT EXISTS analysis_template_name text,
ADD COLUMN IF NOT EXISTS custom_instructions text,
ADD COLUMN IF NOT EXISTS company_count integer DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS ai_analysis_runs_template_idx 
ON ai_ops.ai_analysis_runs(analysis_template_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ai_analysis_runs_company_count_idx 
ON ai_ops.ai_analysis_runs(company_count DESC, started_at DESC);

CREATE INDEX IF NOT EXISTS ai_analysis_runs_mode_status_idx 
ON ai_ops.ai_analysis_runs(analysis_mode, status, started_at DESC);
```

## Issue 2: AI Analysis Returning Identical Results

The AI analysis is returning identical results for all companies, which is not normal. This suggests:

1. **Database insertion errors** - The `initiated_by` field is null, causing analysis runs to fail
2. **AI not actually running** - Fallback data might be used instead of real AI analysis
3. **Cached responses** - The AI might be returning cached responses

## Issue 3: Historical Analyses Not Showing

The new historical analysis page can't load data because:
1. The new columns don't exist in the database
2. The query is failing due to missing columns

## Immediate Actions Needed:

1. **Run the SQL migration above** in Supabase SQL editor
2. **Restart the development server** after the migration
3. **Test a new AI analysis** to see if results are now unique
4. **Check the historical analysis page** to see if it loads data

## Root Cause Analysis:

The `initiated_by` field is null because the frontend is not passing the user ID when making analysis requests. This causes database insertion errors, which might be causing the AI analysis to fail and fall back to default/mock data.

## Next Steps:

After applying the database migration, we need to:
1. Fix the `initiated_by` field issue
2. Verify AI analysis is actually running
3. Test that results are unique for different companies
4. Ensure historical analysis page works correctly
