const { createClient } = require('@supabase/supabase-js')

// Supabase credentials
const supabaseUrl = 'https://clysgodrmowieximfaab.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseXNnb2RybW93aWV4aW1mYWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzQ5NDksImV4cCI6MjA3Mzc1MDk0OX0.vJZP05EV8PeKEW_sAaQG5YblQNI_k8Cyzt45LdFgMDs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function migrateSchema() {
  try {
    console.log('Applying database migration...')
    
    // Since we can't execute raw SQL directly, let's try to insert a test record
    // with the new columns to see if they exist
    const testRecord = {
      id: 'test-migration-' + Date.now(),
      initiated_by: 'test-user',
      status: 'completed',
      model_version: 'gpt-4o-mini',
      analysis_mode: 'screening',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      // Try to insert new columns
      analysis_template_id: 'test-template',
      analysis_template_name: 'Test Template',
      custom_instructions: 'Test instructions',
      company_count: 1
    }
    
    const { data, error } = await supabase
      .from('ai_analysis_runs')
      .insert([testRecord])
    
    if (error) {
      console.error('Migration needed - columns don\'t exist:', error.message)
      console.log('\nPlease run the following SQL in your Supabase SQL editor:')
      console.log(`
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
      `)
    } else {
      console.log('✓ Migration successful - new columns exist')
      
      // Clean up test record
      await supabase
        .from('ai_analysis_runs')
        .delete()
        .eq('id', testRecord.id)
      
      console.log('✓ Test record cleaned up')
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

migrateSchema()
