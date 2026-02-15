import { FinancialData } from '../base';
import { AdaptiveRateLimiter } from './rate-limiter';
import { scraperConfig } from '../../config/scraper.config';

export class AllabolagFinancials {
  private rateLimiter: AdaptiveRateLimiter;
  private buildId: string | null = null;

  constructor() {
    this.rateLimiter = new AdaptiveRateLimiter(scraperConfig.allabolag.rateLimiting.stage3);
  }

  /**
   * Get the current build ID from Allabolag
   */
  private async getBuildId(): Promise<string> {
    if (this.buildId) {
      return this.buildId;
    }

    try {
      const response = await fetch('https://www.allabolag.se');
      const html = await response.text();
      
      // Extract build ID from Next.js build
      const buildIdMatch = html.match(/_next\/static\/([a-zA-Z0-9_-]+)\//);
      if (buildIdMatch) {
        this.buildId = buildIdMatch[1];
        console.log(`Allabolag build ID: ${this.buildId}`);
        return this.buildId;
      }
      
      throw new Error('Could not extract build ID from Allabolag');
    } catch (error) {
      console.error('Failed to get build ID:', error);
      throw error;
    }
  }

  /**
   * Fetch financial data for a company
   */
  async fetchFinancials(companyId: string): Promise<FinancialData[]> {
    return this.rateLimiter.execute(async () => {
      const buildId = await this.getBuildId();
      const url = `https://www.allabolag.se/_next/data/${buildId}/${companyId}.json`;
      
      console.log(`Fetching financials for company ${companyId}...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
          'Referer': 'https://www.allabolag.se/',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`No financial data found for company ${companyId}`);
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseFinancialData(companyId, data);
    });
  }

  /**
   * Parse financial data from Allabolag API response
   */
  private parseFinancialData(companyId: string, data: any): FinancialData[] {
    const financials: FinancialData[] = [];

    try {
      const company = data.pageProps?.company;
      if (!company) {
        console.log(`No company data found for ${companyId}`);
        return [];
      }

      const annualReports = company.annualReports || [];
      
      for (const report of annualReports) {
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
        }

        // Extract key financial metrics
        const financialData: FinancialData = {
          companyId,
          orgnr: company.orgnr || '',
          year: report.year || new Date().getFullYear(),
          period: report.period || '12',
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          currency: report.currency || 'SEK',
          accounts,
          rawData: report,
        };

        financials.push(financialData);
      }

      console.log(`Parsed ${financials.length} financial records for company ${companyId}`);
      return financials;
    } catch (error) {
      console.error(`Error parsing financial data for ${companyId}:`, error);
      return [];
    }
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Reset rate limiter
   */
  resetRateLimiter() {
    this.rateLimiter.reset();
  }
}

// Account code mappings for reference
export const ACCOUNT_CODES = {
  // Revenue
  SDI: 'SDI', // Omsättning (Revenue)
  
  // Profit
  DR: 'DR',   // Årets resultat (Net profit)
  ORS: 'ORS', // Rörelseresultat (Operating result/EBITDA)
  
  // Balance sheet
  EK: 'EK',   // Eget kapital (Equity)
  FK: 'FK',   // Främmande kapital (Debt)
  
  // Other important codes
  ADI: 'ADI', // Avskrivningar (Depreciation)
  ADK: 'ADK', // Avskrivningar på byggnader (Building depreciation)
  ADR: 'ADR', // Avskrivningar på inventarier (Equipment depreciation)
  AK: 'AK',   // Anläggningskapital (Fixed assets)
  ANT: 'ANT', // Antal anställda (Number of employees)
  FI: 'FI',   // Finansiella intäkter (Financial income)
  GG: 'GG',   // Genomsnittligt antal anställda (Average employees)
  KBP: 'KBP', // Kassa och bank (Cash and bank)
  LG: 'LG',   // Leverantörsskulder (Accounts payable)
  RG: 'RG',   // Rörelsekapital (Working capital)
  SAP: 'SAP', // Summa avskrivningar (Total depreciation)
  SED: 'SED', // Summa eget kapital (Total equity)
  SI: 'SI',   // Summa inventarier (Total equipment)
  SEK: 'SEK', // Summa eget kapital (Total equity)
  SF: 'SF',   // Summa fastigheter (Total real estate)
  SFA: 'SFA', // Summa fastigheter och anläggningar (Total real estate and equipment)
  SGE: 'SGE', // Summa genomsnittligt antal anställda (Total average employees)
  SIA: 'SIA', // Summa inventarier och anläggningar (Total equipment and fixed assets)
  SIK: 'SIK', // Summa inventarier och kassa (Total equipment and cash)
  SKG: 'SKG', // Summa kassa och genomsnittligt antal anställda (Total cash and average employees)
  SKGKI: 'SKGKI', // Summa kassa och genomsnittligt antal anställda och inventarier
  SKO: 'SKO', // Summa kassa och omsättning (Total cash and revenue)
  SLG: 'SLG', // Summa leverantörsskulder och genomsnittligt antal anställda
  SOM: 'SOM', // Summa omsättning och medel (Total revenue and means)
  SUB: 'SUB', // Summa utbetalningar (Total payments)
  SV: 'SV',   // Summa varulager (Total inventory)
  SVD: 'SVD', // Summa varulager och debiteringar (Total inventory and receivables)
  UTR: 'UTR', // Utbetalningar (Payments)
  FSD: 'FSD', // Finansiella skulder (Financial debt)
  KB: 'KB',   // Kassa och bank (Cash and bank)
  AWA: 'AWA', // Anställda årsarbetstid (Employee annual work time)
  IAC: 'IAC', // Inventarier och anläggningar (Equipment and fixed assets)
  MIN: 'MIN', // Medel i omlopp (Working capital)
  BE: 'BE',   // Byggnader och egendomar (Buildings and properties)
  TR: 'TR',   // Tillgångar (Assets)
} as const;
