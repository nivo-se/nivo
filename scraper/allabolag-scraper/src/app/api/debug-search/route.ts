import { NextRequest, NextResponse } from 'next/server';
import { withSession, getBuildId, fetchSearchPage } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting detailed search debugging...');
    
    const debugResults = {
      sessionTest: false,
      buildIdTest: false,
      searchTests: [] as any[],
      errors: [] as string[]
    };

    // Test 1: Session Management
    try {
      console.log('🔐 Testing session management...');
      await withSession(async (session) => {
        if (session.cookies) {
          debugResults.sessionTest = true;
          console.log('✅ Session management working');
        } else {
          throw new Error('No cookies found in session');
        }
      });
    } catch (error: any) {
      debugResults.errors.push(`Session management failed: ${error.message}`);
      console.error('❌ Session management failed:', error);
    }

    // Test 2: Build ID
    if (debugResults.sessionTest) {
      try {
        console.log('🏗️ Testing build ID retrieval...');
        await withSession(async (session) => {
          const buildId = await getBuildId(session);
          if (buildId) {
            debugResults.buildIdTest = true;
            console.log(`✅ Build ID retrieved: ${buildId}`);
          } else {
            throw new Error('No build ID returned');
          }
        });
      } catch (error: any) {
        debugResults.errors.push(`Build ID test failed: ${error.message}`);
        console.error('❌ Build ID test failed:', error);
      }
    }

    // Test 3: Multiple Search Attempts
    if (debugResults.buildIdTest) {
      const searchTerms = [
        'AB',
        'Sverige', 
        'Stockholm',
        'Volvo',
        'IKEA',
        'H&M',
        'Ericsson',
        'Skanska',
        'Telia',
        'ICA'
      ];

      for (const term of searchTerms) {
        try {
          console.log(`🔎 Testing search term: "${term}"`);
          await withSession(async (session) => {
            const buildId = await getBuildId(session);
            const searchResults = await fetchSearchPage(buildId, term, session);
            
            const result = {
              term,
              success: false,
              hasPageProps: !!searchResults?.pageProps,
              hasCompanies: false,
              companyCount: 0,
              responseStructure: {},
              error: null
            };

            if (searchResults?.pageProps) {
              result.responseStructure = {
                hasHydrationData: !!searchResults.pageProps.hydrationData,
                hasSearchStore: !!searchResults.pageProps.hydrationData?.searchStore,
                hasCompanies: !!searchResults.pageProps.hydrationData?.searchStore?.companies,
                hasDirectCompanies: !!searchResults.pageProps.companies,
                hydrationDataKeys: Object.keys(searchResults.pageProps.hydrationData || {}),
                directPagePropsKeys: Object.keys(searchResults.pageProps)
              };

              // Check different possible paths for companies
              const companies = 
                searchResults.pageProps.hydrationData?.searchStore?.companies?.companies ||
                searchResults.pageProps.companies ||
                searchResults.pageProps.hydrationData?.companies ||
                [];

              if (Array.isArray(companies) && companies.length > 0) {
                result.success = true;
                result.hasCompanies = true;
                result.companyCount = companies.length;
                console.log(`✅ Search term "${term}" found ${companies.length} companies`);
              } else {
                console.log(`⚠️ Search term "${term}" returned no companies`);
              }
            } else {
              console.log(`⚠️ Search term "${term}" has no pageProps`);
            }

            debugResults.searchTests.push(result);
          });
        } catch (error: any) {
          console.error(`❌ Search term "${term}" failed:`, error);
          debugResults.searchTests.push({
            term,
            success: false,
            error: error.message,
            hasPageProps: false,
            hasCompanies: false,
            companyCount: 0,
            responseStructure: {}
          });
        }

        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    const successfulSearches = debugResults.searchTests.filter(t => t.success);
    const totalSearches = debugResults.searchTests.length;

    const summary = {
      sessionWorking: debugResults.sessionTest,
      buildIdWorking: debugResults.buildIdTest,
      successfulSearches: successfulSearches.length,
      totalSearches,
      successRate: totalSearches > 0 ? (successfulSearches.length / totalSearches) * 100 : 0,
      workingSearchTerms: successfulSearches.map(s => s.term),
      failingSearchTerms: debugResults.searchTests.filter(t => !t.success).map(s => s.term)
    };

    console.log('🔍 Search debugging completed:', summary);
    
    return NextResponse.json({
      success: true,
      summary,
      debugResults,
      recommendations: generateRecommendations(summary, debugResults)
    });
  } catch (error) {
    console.error('💥 Search debugging failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Search debugging failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(summary: any, debugResults: any): string[] {
  const recommendations = [];

  if (!summary.sessionWorking) {
    recommendations.push('Fix session management - cookies are not being retrieved properly');
  }

  if (!summary.buildIdWorking) {
    recommendations.push('Fix build ID retrieval - cannot get build ID from Allabolag.se');
  }

  if (summary.successfulSearches === 0) {
    recommendations.push('All search terms failed - check if Allabolag.se search API has changed');
    recommendations.push('Verify the search endpoint URLs are still valid');
    recommendations.push('Check if Allabolag.se requires different headers or authentication');
  } else if (summary.successRate < 50) {
    recommendations.push('Low search success rate - some search terms work, others don\'t');
    recommendations.push('Consider using only the working search terms');
  }

  if (debugResults.searchTests.length > 0) {
    const firstResult = debugResults.searchTests[0];
    if (!firstResult.hasPageProps) {
      recommendations.push('Search responses don\'t have pageProps - API structure may have changed');
    } else if (!firstResult.hasCompanies) {
      recommendations.push('Search responses have pageProps but no companies - check response structure');
    }
  }

  return recommendations;
}
