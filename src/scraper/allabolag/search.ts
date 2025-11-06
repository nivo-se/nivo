/**
 * Allabolag.se Company Search Module
 * 
 * Function: searchCompanies(term: string, session: AllabolagSession)
 * Returns: [{ name, orgNumber, url, companyId }]
 */

import { AllabolagSession } from './session.js';

export interface SearchResult {
  name: string;
  orgNumber: string; // Placeholder for now, will be populated in getCompanyId
  url: string;
  companyId: string; // Extract from URL
}

/**
 * Get build ID from Allabolag.se
 */
async function getBuildId(session: AllabolagSession): Promise<string> {
  const response = await fetch('https://www.allabolag.se/segmentering', {
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
 * Search for companies on Allabolag.se using segmentation endpoint
 * @param term - Search term (company name)
 * @param session - Session with cookies and token
 * @returns Array of search results with name, orgNumber, url, and companyId
 */
export async function searchCompanies(term: string, session: AllabolagSession): Promise<SearchResult[]> {
  console.log(`🔍 Searching for companies with term: "${term}"`);
  
  try {
    const buildId = await getBuildId(session);
    console.log(`Using build ID: ${buildId}`);
    
    // Use segmentation endpoint with search parameters
    const searchParams = new URLSearchParams({
      q: term,
      page: '1',
      pageSize: '10'
    });
    
    const searchUrl = `https://www.allabolag.se/_next/data/${buildId}/segmentation.json?${searchParams}`;
    console.log(`Search URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Referer': 'https://www.allabolag.se/segmentering',
        'Cookie': session.cookies,
        'X-Request-Verification-Token': session.token,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Search JSON response received`);
    
    // Extract companies from the response
    const companies = data?.pageProps?.companies || [];
    const results: SearchResult[] = [];
    
    for (const company of companies) {
      if (company.companyId && company.name) {
        results.push({
          name: company.name,
          orgNumber: company.organisationNumber || '',
          url: `https://www.allabolag.se/foretag/${company.companyId}`,
          companyId: company.companyId
        });
      }
    }
    
    console.log(`✅ Found ${results.length} companies in search results`);
    return results;
    
  } catch (error) {
    console.error(`❌ Error searching for companies:`, error);
    throw error;
  }
}