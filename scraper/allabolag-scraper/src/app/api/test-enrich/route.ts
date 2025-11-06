import { NextRequest, NextResponse } from 'next/server';
import { getBuildId, fetchSearchPage } from '@/lib/allabolag';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('name') || 'Norrdala Bygg AB';
    const orgnr = searchParams.get('orgnr') || '5591563530';
    
    console.log(`Testing enrichment for: ${companyName} (${orgnr})`);
    
    const buildId = await getBuildId();
    console.log(`Build ID: ${buildId}`);
    
    const searchResults = await fetchSearchPage(buildId, companyName);
    
    // Extract companies from the correct path in the search results
    const companies = searchResults?.pageProps?.hydrationData?.searchStore?.companies?.companies || 
                     searchResults?.pageProps?.companies || [];
    
    console.log(`Found ${companies.length} companies in search results`);
    
    // Find the company that matches our orgnr
    const matchingCompany = companies.find(c => 
      c.orgnr === orgnr || c.organisationNumber === orgnr
    );
    
    console.log('Matching company:', matchingCompany);
    
    if (matchingCompany) {
      const realCompanyId = matchingCompany.companyId || matchingCompany.listingId;
      console.log(`Found company ID: ${realCompanyId}`);
      
      return NextResponse.json({
        success: true,
        companyName,
        orgnr,
        matchingCompany: {
          name: matchingCompany.name,
          orgnr: matchingCompany.orgnr,
          companyId: matchingCompany.companyId,
          listingId: matchingCompany.listingId
        },
        resolvedCompanyId: realCompanyId
      });
    } else {
      return NextResponse.json({
        success: false,
        companyName,
        orgnr,
        companies: companies.map(c => ({
          name: c.name,
          orgnr: c.orgnr,
          companyId: c.companyId
        }))
      });
    }
  } catch (error) {
    console.error('Enrichment test failed:', error);
    return NextResponse.json(
      { 
        error: 'Enrichment test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
