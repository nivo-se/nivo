/**
 * Allabolag.se Financial Data Module
 * 
 * Function: getFinancials(companyId: string, session: AllabolagSession, companyName?: string, industry?: string)
 * Call the JSON endpoint to retrieve financial data.
 * Normalize into a clean schema ready for Supabase insertion.
 */

import { AllabolagSession } from './session.js';

export interface FinancialRecord {
  companyId: string;
  orgnr: string;
  year: string;
  period: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  // Key financial metrics
  sdi: number | null; // Revenue
  dr: number | null;  // Net profit
  ors: number | null; // EBITDA
  ek: number | null;  // Equity
  fk: number | null;  // Debt
  // Additional account codes
  adi: number | null;
  adk: number | null;
  adr: number | null;
  ak: number | null;
  ant: number | null;
  fi: number | null;
  gg: number | null;
  kbp: number | null;
  lg: number | null;
  rg: number | null;
  sap: number | null;
  sed: number | null;
  si: number | null;
  sek: number | null;
  sf: number | null;
  sfa: number | null;
  sge: number | null;
  sia: number | null;
  sik: number | null;
  skg: number | null;
  skgki: number | null;
  sko: number | null;
  slg: number | null;
  som: number | null;
  sub: number | null;
  sv: number | null;
  svd: number | null;
  utr: number | null;
  fsd: number | null;
  kb: number | null;
  awa: number | null;
  iac: number | null;
  min: number | null;
  be: number | null;
  tr: number | null;
  // Raw data for reference
  rawData: any;
  accounts: Record<string, number | null>;
}

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
 * Parse account amount to number
 */
function parseAmount(amount: any): number | null {
  if (amount === null || amount === undefined || amount === '') {
    return null;
  }
  
  const num = Number(String(amount).replace(/\s+/g, ''));
  return Number.isFinite(num) ? num : null;
}

/**
 * Fetch financial data for a company
 * @param companyId - Allabolag.se company ID
 * @param session - Session with cookies and token
 * @param companyName - Company name (for URL construction)
 * @param industry - Industry segment (for URL construction)
 * @returns Array of financial records
 */
export async function getFinancials(
  companyId: string,
  session: AllabolagSession,
  companyName?: string, 
  industry?: string
): Promise<FinancialRecord[]> {
  console.log(`📊 Getting financial data for company ID: ${companyId}`);
  
  const buildId = await getBuildId(session);
  console.log(`Using build ID: ${buildId}`);
  
  // Construct the correct URL format with query parameters
  const url = `https://www.allabolag.se/_next/data/${buildId}/company/${companyId}.json?companyId=${companyId}&name=${encodeURIComponent(companyName || '')}&industry=${encodeURIComponent(industry || '')}&location=-`;
  
  console.log(`Financial data URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Referer': 'https://www.allabolag.se/',
        'Cookie': session.cookies,
        'X-Request-Verification-Token': session.token,
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No financial data found for company ${companyId}`);
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Successfully fetched financial data for company ${companyId}`);
    
    // Parse financial data using the correct structure
    const company = data?.pageProps?.company;
    if (!company) {
      console.log(`No company data found for ${companyId}`);
      return [];
    }
    
    const companyAccounts = company.companyAccounts || [];
    const financials: FinancialRecord[] = [];
    
    console.log(`Processing ${companyAccounts.length} financial records`);
    
    for (const report of companyAccounts) {
      if (!report.accounts || !Array.isArray(report.accounts)) {
        continue;
      }
      
      // Parse account codes
      const accounts: Record<string, number | null> = {};
      
      for (const account of report.accounts) {
        if (account.code && account.amount !== null && account.amount !== undefined) {
          const amount = parseAmount(account.amount);
          if (amount !== null) {
            accounts[account.code] = amount;
          }
        }
      }
      
      // Extract key financial metrics
      const financialData: FinancialRecord = {
        companyId,
        orgnr: company.orgnr || '',
        year: report.year || new Date().getFullYear().toString(),
        period: report.period || '12',
        periodStart: report.periodStart || null,
        periodEnd: report.periodEnd || null,
        currency: report.currency || 'SEK',
        // Map all account codes to individual fields
        sdi: accounts['SDI'] || null, // Revenue
        dr: accounts['DR'] || null,   // Net profit
        ors: accounts['ORS'] || null, // EBITDA
        ek: accounts['EK'] || null,   // Equity
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
        // Store raw data and accounts for reference
        rawData: report,
        accounts: accounts
      };
      
      financials.push(financialData);
    }
    
    console.log(`✅ Successfully parsed ${financials.length} financial records`);
    return financials;
    
  } catch (error) {
    console.error(`❌ Error fetching financial data for ${companyId}:`, error);
    throw error;
  }
}