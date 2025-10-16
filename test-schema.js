const { createClient } = require('@supabase/supabase-js')

// Supabase credentials
const supabaseUrl = 'https://clysgodrmowieximfaab.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseXNnb2RybW93aWV4aW1mYWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzQ5NDksImV4cCI6MjA3Mzc1MDk0OX0.vJZP05EV8PeKEW_sAaQG5YblQNI_k8Cyzt45LdFgMDs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSchema() {
  try {
    console.log('Testing database schema...')
    
    // Test if we can query ai_analysis_runs
    const { data: runs, error: runsError } = await supabase
      .from('ai_analysis_runs')
      .select('*')
      .limit(1)
    
    if (runsError) {
      console.error('Error querying ai_analysis_runs:', runsError)
      return
    }
    
    console.log('✓ ai_analysis_runs table accessible')
    
    if (runs.length > 0) {
      const columns = Object.keys(runs[0])
      console.log('Current columns:', columns)
      
      // Check if new columns exist
      const newColumns = [
        'analysis_template_id',
        'analysis_template_name', 
        'custom_instructions',
        'company_count'
      ]
      
      const missingColumns = newColumns.filter(col => !columns.includes(col))
      
      if (missingColumns.length === 0) {
        console.log('✓ All new columns already exist')
      } else {
        console.log('Missing columns:', missingColumns)
        console.log('Need to run migration')
      }
    } else {
      console.log('No data in ai_analysis_runs table')
    }
    
    // Test if we can query analysis runs with company data
    const { data: runsWithCompanies, error: companiesError } = await supabase
      .from('ai_analysis_runs')
      .select(`
        *,
        ai_company_analysis(orgnr, company_name),
        ai_screening_results(orgnr, company_name)
      `)
      .limit(1)
    
    if (companiesError) {
      console.error('Error querying runs with companies:', companiesError)
    } else {
      console.log('✓ Can query runs with company data')
      console.log('Found', runsWithCompanies.length, 'runs with company data')
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testSchema()
