import { withRetry } from './retry';

export interface AllabolagSession {
  cookies: string;
  token: string;
}

/**
 * Fetches a fresh session from Allabolag.se
 * Gets cookies and __RequestVerificationToken for authenticated requests
 */
export async function getAllabolagSession(): Promise<AllabolagSession> {
  console.log('🔐 Fetching new Allabolag session...');
  
  try {
    // Use unified proxy (Oxylabs or ProxyScrape) - REQUIRED, no fallback
    const { fetchWithProxy } = await import('./unified-proxy');
    const response = await fetchWithProxy('https://www.allabolag.se/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br', // Keep compression - reduces data size
        // Removed unnecessary headers to reduce request size
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
    }

    // Extract cookies from response headers
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');

    // Extract __RequestVerificationToken from HTML
    const html = await response.text();
    
    // Try different token patterns
    let token = '';
    const tokenPatterns = [
      /name="__RequestVerificationToken"\s+value="([^"]+)"/,
      /name="__RequestVerificationToken"\s+content="([^"]+)"/,
      /<meta name="__RequestVerificationToken" content="([^"]+)" \/>/,
      /<input[^>]*name="__RequestVerificationToken"[^>]*value="([^"]+)"/,
      /"__RequestVerificationToken":"([^"]+)"/
    ];
    
    for (const pattern of tokenPatterns) {
      const match = html.match(pattern);
      if (match) {
        token = match[1];
        console.log(`✅ Found token using pattern: ${pattern}`);
        break;
      }
    }
    
    if (!token) {
      console.log('🔍 Token patterns tried but none matched. HTML snippet:', html.substring(0, 500));
    }

    if (!token) {
      console.warn('⚠️  No __RequestVerificationToken found in response - continuing without token');
    }

    if (!cookies) {
      console.warn('⚠️  No cookies found in response');
    }

    console.log(`✅ Session established with ${setCookieHeaders.length} cookies`);
    console.log(`Cookies: ${cookies}`);
    console.log(`Token: ${token ? 'Found' : 'Not found'}`);
    
    return {
      cookies,
      token
    };

  } catch (error) {
    console.error('❌ Failed to establish session:', error);
    throw error;
  }
}

/**
 * Utility function to automatically refresh session on 403 or empty results
 */
export async function withSession<T>(fn: (session: AllabolagSession) => Promise<T>, retries = 3): Promise<T> {
  let session = await getAllabolagSession();
  
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn(session);
      
      // Check for empty results or specific indicators of a bad session
      if (Array.isArray(result) && result.length === 0 && i < retries - 1) {
        console.warn(`⚠️  Attempt ${i + 1}: Empty result. Refreshing session...`);
        session = await getAllabolagSession();
        continue;
      }
      
      return result;
    } catch (error: any) {
      if ((error.message.includes('403') || error.message.includes('empty result')) && i < retries - 1) {
        console.warn(`⚠️  Attempt ${i + 1}: Session error (${error.message}). Refreshing session...`);
        session = await getAllabolagSession();
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to complete operation after multiple session refreshes.');
}

export async function getBuildId(session?: AllabolagSession): Promise<string> {
  return withRetry(async () => {
    // Use unified proxy (Oxylabs or ProxyScrape) for all requests
    const { fetchWithProxy } = await import('./unified-proxy');
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    if (session) {
      headers['Cookie'] = session.cookies;
      headers['X-Request-Verification-Token'] = session.token;
    }
    
    const response = await fetchWithProxy('https://www.allabolag.se/segmentering', { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch segmentering page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Try to parse __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        if (nextData.buildId) {
          return nextData.buildId;
        }
      } catch (e) {
        console.warn('Failed to parse __NEXT_DATA__:', e);
      }
    }
    
    // Fallback: look for buildId in _next/static paths
    const buildManifestMatch = html.match(/_next\/static\/([^\/]+)\/_buildManifest\.js/);
    if (buildManifestMatch) {
      return buildManifestMatch[1];
    }
    
    // Another fallback: look for any _next/data path
    const dataPathMatch = html.match(/_next\/data\/([^\/]+)\/segmentation\.json/);
    if (dataPathMatch) {
      return dataPathMatch[1];
    }
    
    throw new Error('Could not find buildId in segmentering page');
  });
}

export type SegmentationParams = {
  revenueFrom: number;
  revenueTo: number;
  profitFrom?: number;
  profitTo?: number;
  companyType?: "AB";
  page?: number;
};

export async function fetchSegmentationPage(
  buildId: string, 
  params: SegmentationParams,
  session?: AllabolagSession
): Promise<any> {
  const searchParams = new URLSearchParams({
    companyType: params.companyType || "AB",
    revenueFrom: params.revenueFrom.toString(),
    revenueTo: params.revenueTo.toString(),
    page: (params.page || 1).toString(),
  });
  
  // Only add profit parameters if they are defined
  if (params.profitFrom !== undefined) {
    searchParams.set('profitFrom', params.profitFrom.toString());
  }
  if (params.profitTo !== undefined) {
    searchParams.set('profitTo', params.profitTo.toString());
  }

  const url = `https://www.allabolag.se/_next/data/${buildId}/segmentation.json?${searchParams}`;
  
  return withRetry(async () => {
    // Use unified proxy (Oxylabs or ProxyScrape) for all requests
    const { fetchWithProxy } = await import('./unified-proxy');
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br', // Keep compression - reduces data size
      'Referer': 'https://www.allabolag.se/segmentering'
    };
    
    if (session) {
      headers['Cookie'] = session.cookies;
      headers['X-Request-Verification-Token'] = session.token;
    }
    
    const response = await fetchWithProxy(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch segmentation page: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  });
}

export async function fetchSearchPage(
  buildId: string,
  query: string,
  session?: AllabolagSession
): Promise<any> {
  // Try HTML search first, then JSON endpoints
  const searchParams = new URLSearchParams({
    q: query,
  });

  // First try HTML search to extract company IDs from URLs
  try {
    console.log(`Trying HTML search for: ${query}`);
    
    // Use unified proxy (Oxylabs or ProxyScrape) for all requests
    const { fetchWithProxy } = await import('./unified-proxy');
    
    const htmlUrl = `https://www.allabolag.se/bransch-sok?${searchParams}`;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br', // Keep compression - reduces data size
      'Referer': 'https://www.allabolag.se/'
    };
    
    if (session) {
      headers['Cookie'] = session.cookies;
      headers['X-Request-Verification-Token'] = session.token;
    }
    
    const response = await fetchWithProxy(htmlUrl, { headers });
    
    if (response.ok) {
      const html = await response.text();
      
      // Extract company URLs from HTML
      const companyUrlMatches = html.match(/href="\/foretag\/[^"]+\/([A-Z0-9]+)"/g);
      if (companyUrlMatches && companyUrlMatches.length > 0) {
        console.log(`Found ${companyUrlMatches.length} company URLs in HTML search`);
        
        // Parse the URLs to extract company IDs and organization numbers
        const companies = companyUrlMatches.map(match => {
          const urlMatch = match.match(/href="\/foretag\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([A-Z0-9]+)"/);
          if (urlMatch) {
            const companyId = urlMatch[4];
            // Try to extract organization number from the HTML content around this URL
            const orgnrMatch = html.match(new RegExp(`href="${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[^<]*<[^>]*>([0-9]{10,12})<`));
            const orgnr = orgnrMatch ? orgnrMatch[1] : null;
            
            return {
              companyId: companyId,
              organisationNumber: orgnr,
              url: `/foretag/${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}/${companyId}`
            };
          }
          return null;
        }).filter(Boolean);
        
        if (companies.length > 0) {
          return {
            pageProps: {
              companies: companies
            }
          };
        }
      }
    }
  } catch (error) {
    console.log(`HTML search failed:`, error.message);
  }

  // Fallback to JSON endpoints
  const searchUrls = [
    `https://www.allabolag.se/_next/data/${buildId}/bransch-sok.json?${searchParams}`,
    `https://www.allabolag.se/_next/data/${buildId}/search.json?${searchParams}`,
    `https://www.allabolag.se/_next/data/${buildId}/sok.json?${searchParams}`
  ];
  
  // Use unified proxy (Oxylabs or ProxyScrape) for all requests
  const { fetchWithProxy } = await import('./unified-proxy');
  
  for (const url of searchUrls) {
    try {
      console.log(`Trying search URL: ${url}`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.allabolag.se/'
      };
      
      if (session) {
        headers['Cookie'] = session.cookies;
        headers['X-Request-Verification-Token'] = session.token;
      }
      
      const response = await fetchWithProxy(url, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Search successful with URL: ${url}`);
        return data;
      }
    } catch (error) {
      console.log(`Search failed with URL ${url}:`, error.message);
      continue;
    }
  }
  
  throw new Error('All search endpoints failed');
}

export function normalizeCompany(c: any) {
  return {
    orgnr: String(c.organisationNumber ?? "").trim(),
    companyName: String(c.displayName ?? c.name ?? "").trim(),
    companyId: c.companyId ? String(c.companyId) : null,
    companyIdHint: c.companyId ? String(c.companyId) : null,
    homepage: c.homePage ?? null,
    naceCategories: Array.isArray(c.naceCategories) ? c.naceCategories : [],
    segmentName: Array.isArray(c.proffIndustries) 
      ? c.proffIndustries.map((i: any) => i?.name).filter(Boolean) 
      : [],
    revenueSek: toInt(c.revenue),
    profitSek: toInt(c.profit),
    foundationYear: toInt(c.foundationYear),
    accountsLastYear: c.companyAccountsLastUpdatedDate 
      ? String(c.companyAccountsLastUpdatedDate) 
      : null,
  };
}

function toInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\s+/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function fetchFinancialData(
  buildId: string, 
  companyData: any, 
  session?: AllabolagSession
): Promise<any[]> {
  // Extract company information for URL construction
  const orgnr = companyData.orgnr;
  const companyName = companyData.company_name;
  const segmentName = companyData.segment_name;
  
  // We need the companyId to construct the correct URL
  // The companyId should be passed in the companyData
  const companyId = companyData.companyId;
  
  if (!companyId) {
    console.log(`No companyId provided for ${companyName} (${orgnr})`);
    return [];
  }
  
  // Use the correct URL format with query parameters
  const url = `https://www.allabolag.se/_next/data/${buildId}/company/${companyId}.json?companyId=${companyId}&name=${encodeURIComponent(companyName || '')}&industry=${encodeURIComponent(segmentName || '')}&location=-`;
  
  try {
    console.log(`Fetching financial data from: ${url}`);
    
    // Use unified proxy (Oxylabs or ProxyScrape) for all requests
    const { fetchWithProxy } = await import('./unified-proxy');
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      'Referer': 'https://www.allabolag.se/',
    };
    
    if (session) {
      headers['Cookie'] = session.cookies;
      headers['X-Request-Verification-Token'] = session.token;
    }
    
    const response = await fetchWithProxy(url, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No financial data found for company ${companyId}`);
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Successfully fetched data for ${companyName} (${orgnr})`);
    
    // Parse financial data using the correct structure
    const company = data?.pageProps?.company;
    if (!company) {
      console.log(`No company data found for ${companyId}`);
      return [];
    }
    
    const companyAccounts = company.companyAccounts || [];
    const financials = [];
    
    for (const report of companyAccounts) {
      if (!report.accounts || !Array.isArray(report.accounts)) {
        continue;
      }
      
      // Parse account codes
      const accounts: Record<string, number | null> = {};
      
      for (const account of report.accounts) {
        if (account.code && account.amount !== null && account.amount !== undefined) {
          const amount = parseFloat(account.amount);
          if (!isNaN(amount)) {
            accounts[account.code] = amount;
          }
        }
        // Also check account name/label for Eget kapital (Equity) if code lookup fails
        if (account.name || account.label) {
          const name = String(account.name || account.label || '').toLowerCase();
          const amount = account.amount ? parseFloat(account.amount) : null;
          if (!isNaN(amount || 0) && amount !== null) {
            // Map "Eget kapital" to EK code
            if (name.includes('eget') && name.includes('kapital')) {
              accounts['EK'] = accounts['EK'] || amount;
            }
          }
        }
      }
      
      // Extract key financial metrics
      const financialData = {
        companyId,
        orgnr: company.orgnr || '',
        year: report.year || new Date().getFullYear(),
        period: report.period || '12',
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        currency: report.currency || 'SEK',
        // Map all account codes to individual fields
        sdi: accounts['SDI'] || null, // Revenue
        dr: accounts['DR'] || null,   // Net profit
        ors: accounts['ORS'] || null, // EBITDA
        ek: accounts['EK'] || null,   // Equity (Eget kapital)
        fk: accounts['FK'] || null,   // Debt
        adi: accounts['ADI'] || null,
        adk: accounts['ADK'] || null,
        adr: accounts['ADR'] || null,
        ak: accounts['AK'] || null,
        ant: accounts['ANT'] || null,
        fi: accounts['FI'] || null,
        gg: accounts['GG'] || null,
        kbp: accounts['KBP'] || null,
        lg: accounts['LG'] || null,
        rg: accounts['RG'] || null,
        sap: accounts['SAP'] || null,
        sed: accounts['SED'] || null,
        si: accounts['SI'] || null,
        sek: accounts['SEK'] || null,
        sf: accounts['SF'] || null,
        sfa: accounts['SFA'] || null,
        sge: accounts['SGE'] || null,
        sia: accounts['SIA'] || null,
        sik: accounts['SIK'] || null,
        skg: accounts['SKG'] || null,
        skgki: accounts['SKGKI'] || null,
        sko: accounts['SKO'] || null,
        slg: accounts['SLG'] || null,
        som: accounts['SOM'] || null,
        sub: accounts['SUB'] || null,
        sv: accounts['SV'] || null,
        svd: accounts['SVD'] || null,
        utr: accounts['UTR'] || null,
        fsd: accounts['FSD'] || null,
        kb: accounts['KB'] || null,
        awa: accounts['AWA'] || null,
        iac: accounts['IAC'] || null,
        min: accounts['MIN'] || null,
        be: accounts['BE'] || null,
        tr: accounts['TR'] || null,
        rawData: report
      };
      
      financials.push(financialData);
    }
    
    console.log(`Parsed ${financials.length} financial records for company ${companyId}`);
    
    // Extract additional company data from the response
    const additionalCompanyData = {
      employees: company.employees || null,
      description: company.description || null,
      phone: company.phone || null,
      email: company.email || null,
      legalName: company.legalName || null,
      domicile: company.domicile || null,
      signatory: company.signatory || null,
      directors: company.directors || null,
      foundationDate: company.foundationDate || null,
      businessUnitType: company.businessUnitType || null,
      industries: company.industries || null,
      certificates: company.certificates || null,
      externalLinks: company.externalLinks || null,
    };
    
    // Add additional company data to each financial record
    const enrichedFinancials = financials.map(financial => ({
      ...financial,
      additionalCompanyData,
      // Store the complete raw response for backup
      completeRawData: data
    }));
    
    return enrichedFinancials;
    
  } catch (error) {
    console.error(`Error fetching financial data for ${companyId}:`, error);
    return [];
  }
}









