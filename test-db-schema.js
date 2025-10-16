const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSchema() {
  try {
    console.log('Testing database schema...')
    
    // Test if the new columns exist
    const { data, error } = await supabase
      .from('ai_analysis_runs')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error querying ai_analysis_runs:', error)
      return
    }
    
    console.log('ai_analysis_runs columns:', data.length > 0 ? Object.keys(data[0]) : 'No data')
    
    // Test if we can query analysis runs
    const { data: runs, error: runsError } = await supabase
      .from('ai_analysis_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5)
    
    if (runsError) {
      console.error('Error querying runs:', runsError)
    } else {
      console.log('Found', runs.length, 'analysis runs')
      if (runs.length > 0) {
        console.log('Latest run:', {
          id: runs[0].id,
          analysis_mode: runs[0].analysis_mode,
          status: runs[0].status,
          started_at: runs[0].started_at,
          has_template_id: 'analysis_template_id' in runs[0],
          has_template_name: 'analysis_template_name' in runs[0],
          has_custom_instructions: 'custom_instructions' in runs[0],
          has_company_count: 'company_count' in runs[0]
        })
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testSchema()
