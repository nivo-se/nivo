const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Supabase credentials
const supabaseUrl = 'https://clysgodrmowieximfaab.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseXNnb2RybW93aWV4aW1mYWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzQ5NDksImV4cCI6MjA3Mzc1MDk0OX0.vJZP05EV8PeKEW_sAaQG5YblQNI_k8Cyzt45LdFgMDs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('Applying database migration...')
    
    // Read the migration file
    const migration = fs.readFileSync('database/historical_analysis_schema_update.sql', 'utf8')
    
    // Split the migration into individual statements
    const statements = migration
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}: ${statement.substring(0, 50)}...`)
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error)
          // Continue with other statements
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`)
        }
      }
    }
    
    console.log('Migration completed!')
    
    // Test the new columns
    console.log('\nTesting new columns...')
    const { data: testData, error: testError } = await supabase
      .from('ai_analysis_runs')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('Error testing new columns:', testError)
    } else {
      console.log('Available columns:', testData.length > 0 ? Object.keys(testData[0]) : 'No data')
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

applyMigration()
