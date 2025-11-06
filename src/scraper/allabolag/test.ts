/**
 * Allabolag Scraper Test Script
 * 
 * Tests the complete scraping workflow with session management:
 * 1. Search for companies
 * 2. Extract company IDs
 * 3. Fetch financial data
 * 4. Log normalized output
 */

import { withSession } from './session.js';
import { searchCompanies, SearchResult } from './search.js';
import { getCompanyId, getCompanyIdByName } from './getCompanyId.js';
import { getFinancials, FinancialRecord } from './getFinancials.js';

interface TestResult {
  searchResult: SearchResult;
  companyId: string | null;
  financials: FinancialRecord[];
  success: boolean;
  error?: string;
}

/**
 * Normalize and display financial data
 */
function displayFinancials(financials: FinancialRecord[]): void {
  if (financials.length === 0) {
    console.log('  📊 No financial data available');
    return;
  }

  console.log(`  📊 Financial data (${financials.length} records):`);
  
  for (const record of financials.slice(0, 3)) { // Show max 3 years
    console.log(`    Year ${record.year}:`);
    console.log(`      Revenue (SDI): ${record.sdi ? record.sdi.toLocaleString() + ' SEK' : 'N/A'}`);
    console.log(`      Net Profit (DR): ${record.dr ? record.dr.toLocaleString() + ' SEK' : 'N/A'}`);
    console.log(`      EBITDA (ORS): ${record.ors ? record.ors.toLocaleString() + ' SEK' : 'N/A'}`);
    console.log(`      Equity (EK): ${record.ek ? record.ek.toLocaleString() + ' SEK' : 'N/A'}`);
    console.log(`      Debt (FK): ${record.fk ? record.fk.toLocaleString() + ' SEK' : 'N/A'}`);
  }
}

/**
 * Process a single company through the complete workflow
 */
async function processCompany(
  searchResult: SearchResult, 
  session: any
): Promise<TestResult> {
  const result: TestResult = {
    searchResult,
    companyId: null,
    financials: [],
    success: false
  };

  try {
    console.log(`\n🏢 Processing: ${searchResult.name}`);
    console.log(`   URL: ${searchResult.url}`);
    console.log(`   Company ID from URL: ${searchResult.companyId}`);

    // Try to get company ID (we already have it from search, but let's verify)
    let companyId = searchResult.companyId;
    
    // If we don't have a company ID from the search, try to extract it
    if (!companyId) {
      console.log('   🔍 Extracting company ID...');
      companyId = await getCompanyId(searchResult.orgNumber, session);
    }

    if (!companyId) {
      throw new Error('Could not determine company ID');
    }

    result.companyId = companyId;
    console.log(`   ✅ Company ID: ${companyId}`);

    // Fetch financial data
    console.log('   📊 Fetching financial data...');
    const financials = await getFinancials(companyId, session, searchResult.name);
    result.financials = financials;

    if (financials.length > 0) {
      console.log(`   ✅ Found ${financials.length} financial records`);
      displayFinancials(financials);
    } else {
      console.log('   ⚠️  No financial data found');
    }

    result.success = true;
    return result;

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    result.error = error.message;
    return result;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Starting Allabolag Scraper Test with Session Management');
  console.log('========================================================');

  try {
    await withSession(async (session) => {
      console.log('✅ Session established successfully');

      // Step 1: Test with a known company that has financial data
      console.log('\n🔍 Step 1: Testing with known company...');
      
      // Use a company we know has financial data from previous tests
      const testCompany = {
        name: 'LKAB Mekaniska AB',
        orgNumber: '5560133059',
        url: 'https://www.allabolag.se/foretag/lkab-mekaniska-ab/-/mekaniska-verkst%C3%A4der/2JYCY4JI5YG9P',
        companyId: '2JYCY4JI5YG9P'
      };
      
      console.log(`✅ Using test company: ${testCompany.name}`);
      
      // Step 2: Process the test company
      console.log('\n🏢 Step 2: Processing test company...');
      const testResults: TestResult[] = [];
      
      const result = await processCompany(testCompany, session);
      testResults.push(result);

      // Step 3: Summary
      console.log('\n📊 Test Summary');
      console.log('================');
      
      const successful = testResults.filter(r => r.success);
      const failed = testResults.filter(r => !r.success);
      
      console.log(`✅ Successful: ${successful.length}/${testResults.length}`);
      console.log(`❌ Failed: ${failed.length}/${testResults.length}`);
      
      if (successful.length > 0) {
        console.log('\n✅ Successful companies:');
        for (const result of successful) {
          console.log(`  • ${result.searchResult.name} (${result.companyId}) - ${result.financials.length} financial records`);
        }
      }
      
      if (failed.length > 0) {
        console.log('\n❌ Failed companies:');
        for (const result of failed) {
          console.log(`  • ${result.searchResult.name}: ${result.error}`);
        }
      }

      console.log('\n🎉 Test completed successfully!');
    });

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);