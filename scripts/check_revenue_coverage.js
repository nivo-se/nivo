import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../frontend/.env.local') })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkCoverage() {
  const { count: totalCompanies } = await supabase.from('companies').select('*', { count: 'exact', head: true })
  const { count: companiesWithMetrics } = await supabase.from('company_metrics').select('*', { count: 'exact', head: true }).not('latest_revenue_sek', 'is', null)
  
  // Count unique companies with revenue in company_financials
  const { data: financialsData } = await supabase
    .from('company_financials')
    .select('orgnr')
    .eq('period', '12')
    .not('revenue_sek', 'is', null)
  
  const uniqueCompaniesWithFinancials = new Set(financialsData?.map(f => f.orgnr) || []).size

  console.log('Total companies:', totalCompanies)
  console.log('Companies with revenue in company_metrics:', companiesWithMetrics)
  console.log('Unique companies with revenue in company_financials (period=12):', uniqueCompaniesWithFinancials)
  console.log('Missing from company_metrics:', (totalCompanies || 0) - (companiesWithMetrics || 0))
}

checkCoverage().catch(console.error)

