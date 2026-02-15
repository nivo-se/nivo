import { 
  ScraperProvider, 
  SearchFilters, 
  CompanyBasic, 
  FinancialData, 
  RateLimitConfig 
} from '../base';
import { AllabolagFinancials } from './financials';
import { scraperConfig } from '../../config/scraper.config';

export class AllabolagProvider implements ScraperProvider {
  name = 'allabolag';
  private financials: AllabolagFinancials;

  constructor() {
    this.financials = new AllabolagFinancials();
  }

  /**
   * Stage 1: Search/filter companies
   * This uses the existing segmentation logic
   */
  async *searchCompanies(filters: SearchFilters): AsyncGenerator<CompanyBasic> {
    // This will be implemented by calling the existing segmentation API
    // For now, return empty generator - the actual implementation will be in the API endpoints
    yield* [];
  }

  /**
   * Stage 2: Get canonical company IDs
   * This uses the existing company ID resolution logic
   */
  async resolveCompanyId(orgnr: string, companyName?: string): Promise<string | null> {
    // This will be implemented by calling the existing company ID resolution API
    // For now, return null - the actual implementation will be in the API endpoints
    return null;
  }

  /**
   * Stage 3: Fetch financial data
   * This is the new implementation using the financials class
   */
  async fetchFinancials(companyId: string): Promise<FinancialData[]> {
    return this.financials.fetchFinancials(companyId);
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig(): RateLimitConfig {
    return scraperConfig.allabolag.rateLimiting.stage3;
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    console.log('Initializing Allabolag provider...');
    // Any initialization logic can go here
  }

  /**
   * Cleanup the provider
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up Allabolag provider...');
    this.financials.resetRateLimiter();
  }

  /**
   * Get current rate limiting statistics
   */
  getRateLimitStats() {
    return this.financials.getRateLimitStats();
  }
}
