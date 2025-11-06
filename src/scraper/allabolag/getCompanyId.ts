/**
 * Allabolag.se Company ID Extraction Module
 * 
 * Function: getCompanyId(orgNumber: string, session: AllabolagSession)
 * Fetch company page and extract internal companyId from embedded JSON/HTML.
 */

import { AllabolagSession } from './session.js';

/**
 * Get the current build ID from Allabolag.se
 */
async function getBuildId(session: AllabolagSession): Promise<string> {
  const response = await fetch('https://www.allabolag.se/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Cookie': session.cookies,
      'X-Request-Verification-Token': session.token,
    }
  });
  
  const html = await response.text();
  const buildIdMatch = html.match(/_next\/static\/([^\/]+)\/_buildManifest\.js/);
  
  if (!buildIdMatch) {
    throw new Error('Could not extract build ID from Allabolag.se');
  }
  
  return buildIdMatch[1];
}

/**
 * Extract company ID from organization number by searching Allabolag.se
 * @param orgNumber - Swedish organization number (10-12 digits)
 * @param session - Session with cookies and token
 * @returns Company ID string or null if not found
 */
export async function getCompanyId(orgNumber: string, session: AllabolagSession): Promise<string | null> {
  console.log(`🔍 Getting company ID for organization number: ${orgNumber}`);
  
  const buildId = await getBuildId(session);
  console.log(`Using build ID: ${buildId}`);
  
  // First, we need to find the company by searching with the org number
  // Allabolag.se doesn't have a direct org number lookup, so we'll use a search approach
  
  try {
    // Try searching with the org number directly
    const searchParams = new URLSearchParams({
      q: orgNumber,
    });
    
    const searchUrl = `https://www.allabolag.se/_next/data/${buildId}/bransch-sok.json?${searchParams}`;
    console.log(`Search URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Referer': 'https://www.allabolag.se/',
        'Cookie': session.cookies,
        'X-Request-Verification-Token': session.token,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Search response received`);
    
    // Extract companies from the search results
    const companies = data?.pageProps?.hydrationData?.searchStore?.companies?.companies || 
                     data?.pageProps?.companies || [];
    
    console.log(`Found ${companies.length} companies in search results`);
    
    // Find the company that matches our org number
    const matchingCompany = companies.find((company: any) => 
      company.orgnr === orgNumber || company.organisationNumber === orgNumber
    );
    
    if (matchingCompany) {
      // Use regex to extract companyId from the response
      const companyIdMatch = JSON.stringify(matchingCompany).match(/"companyId":"([A-Za-z0-9_-]{8,20})"/);
      const companyId = companyIdMatch ? companyIdMatch[1] : (matchingCompany.companyId || matchingCompany.listingId);
      
      console.log(`✅ Found matching company:`, {
        name: matchingCompany.name,
        orgnr: matchingCompany.orgnr,
        companyId: companyId
      });
      
      if (companyId) {
        console.log(`✅ Successfully extracted company ID: ${companyId}`);
        return companyId;
      } else {
        console.log(`⚠️  Company found but no company ID available`);
        return null;
      }
    } else {
      console.log(`❌ No company found with organization number: ${orgNumber}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error getting company ID for ${orgNumber}:`, error);
    throw error;
  }
}

/**
 * Alternative method: Get company ID from company name (if org number search fails)
 * @param companyName - Company name to search for
 * @param orgNumber - Organization number to match against
 * @param session - Session with cookies and token
 * @returns Company ID string or null if not found
 */
export async function getCompanyIdByName(
  companyName: string, 
  orgNumber: string, 
  session: AllabolagSession
): Promise<string | null> {
  console.log(`🔍 Getting company ID by name: "${companyName}" (${orgNumber})`);
  
  const buildId = await getBuildId(session);
  
  try {
    const searchParams = new URLSearchParams({
      q: companyName,
    });
    
    const searchUrl = `https://www.allabolag.se/_next/data/${buildId}/bransch-sok.json?${searchParams}`;
    console.log(`Search URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Referer': 'https://www.allabolag.se/',
        'Cookie': session.cookies,
        'X-Request-Verification-Token': session.token,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract companies from the search results
    const companies = data?.pageProps?.hydrationData?.searchStore?.companies?.companies || 
                     data?.pageProps?.companies || [];
    
    console.log(`Found ${companies.length} companies in search results`);
    
    // Find the company that matches our org number
    const matchingCompany = companies.find((company: any) => 
      company.orgnr === orgNumber || company.organisationNumber === orgNumber
    );
    
    if (matchingCompany) {
      // Use regex to extract companyId from the response
      const companyIdMatch = JSON.stringify(matchingCompany).match(/"companyId":"([A-Za-z0-9_-]{8,20})"/);
      const companyId = companyIdMatch ? companyIdMatch[1] : (matchingCompany.companyId || matchingCompany.listingId);
      
      console.log(`✅ Found matching company by name:`, {
        name: matchingCompany.name,
        orgnr: matchingCompany.orgnr,
        companyId: companyId
      });
      
      return companyId || null;
    } else {
      console.log(`❌ No company found with name "${companyName}" and org number ${orgNumber}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error getting company ID by name for ${companyName}:`, error);
    throw error;
  }
}