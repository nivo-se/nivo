/**
 * Nivo Segmentation Service
 * 
 * Provides functions to fetch Tier 1, 2, and 3 companies based on segmentation scores.
 * 
 * Tiers are assigned based on ranking:
 * - Tier 1: Top 100 companies (rank 1-100)
 * - Tier 2: Next 100 companies (rank 101-200)
 * - Tier 3: Next 100 companies (rank 201-300)
 * - Unsegmented: Companies with fit_score < 60 or rank > 300
 */

import { supabase } from './supabase';
import { supabaseCompanyService, type SupabaseCompany } from './supabaseCompanyService';

export interface SegmentedTargets {
  tier1: SupabaseCompany[];
  tier2: SupabaseCompany[];
  tier3: SupabaseCompany[];
}

export interface SegmentationOptions {
  limit1?: number;
  limit2?: number;
  limit3?: number;
  includeMetrics?: boolean;
}

/**
 * Fetches all Tier 1, 2, and 3 companies, ordered by fit_score DESC, then nivo_total_score DESC.
 * 
 * @param options - Query options
 * @param options.limit1 - Maximum number of Tier 1 companies to return (default: 200)
 * @param options.limit2 - Maximum number of Tier 2 companies to return (default: 200)
 * @param options.limit3 - Maximum number of Tier 3 companies to return (default: 200)
 * @param options.includeMetrics - Whether to include detailed financial metrics (default: true)
 * @returns Object containing tier1, tier2, and tier3 arrays
 */
export async function getSegmentedTargets(
  options: SegmentationOptions = {}
): Promise<SegmentedTargets> {
  const { limit1 = 100, limit2 = 100, limit3 = 100, includeMetrics = true } = options;

  // Fetch top companies directly with JOIN - much more efficient!
  // Get companies with their scores in one query per tier
  // Also fetch EBIT (RG) from account_codes for margin calculation
  const [tier1Result, tier2Result, tier3Result] = await Promise.all([
    supabase
      .from('company_metrics')
      .select(`
        orgnr,
        fit_score,
        ops_upside_score,
        nivo_total_score,
        segment_tier,
        latest_revenue_sek,
        latest_profit_sek,
        revenue_cagr_3y,
        companies!inner (
          orgnr,
          company_name,
          address,
          homepage,
          email,
          phone,
          segment_names,
          foundation_year,
          employees_latest
        ),
        company_financials!inner (
          account_codes
        )
      `)
      .eq('segment_tier', '1')
      .eq('company_financials.year', 'company_metrics.latest_year')
      .order('fit_score', { ascending: false })
      .order('nivo_total_score', { ascending: false })
      .limit(limit1),
    supabase
      .from('company_metrics')
      .select(`
        orgnr,
        fit_score,
        ops_upside_score,
        nivo_total_score,
        segment_tier,
        latest_revenue_sek,
        latest_profit_sek,
        revenue_cagr_3y,
        companies!inner (
          orgnr,
          company_name,
          address,
          homepage,
          email,
          phone,
          segment_names,
          foundation_year,
          employees_latest
        ),
        company_financials!inner (
          account_codes
        )
      `)
      .eq('segment_tier', '2')
      .eq('company_financials.year', 'company_metrics.latest_year')
      .order('fit_score', { ascending: false })
      .order('nivo_total_score', { ascending: false })
      .limit(limit2),
    supabase
      .from('company_metrics')
      .select(`
        orgnr,
        fit_score,
        ops_upside_score,
        nivo_total_score,
        segment_tier,
        latest_revenue_sek,
        latest_profit_sek,
        revenue_cagr_3y,
        companies!inner (
          orgnr,
          company_name,
          address,
          homepage,
          email,
          phone,
          segment_names,
          foundation_year,
          employees_latest
        ),
        company_financials!inner (
          account_codes
        )
      `)
      .eq('segment_tier', '3')
      .eq('company_financials.year', 'company_metrics.latest_year')
      .order('fit_score', { ascending: false })
      .order('nivo_total_score', { ascending: false })
      .limit(limit3),
  ]);

  // Transform results to SupabaseCompany format
  const transformToCompany = (row: any): SupabaseCompany | null => {
    if (!row.companies) return null;
    
    const company = row.companies;
    
    // Extract address and city (helper functions from supabaseCompanyService)
    let addressStr: string | undefined;
    let cityStr: string | undefined;
    if (company.address) {
      try {
        const address = typeof company.address === 'string' ? JSON.parse(company.address) : company.address;
        addressStr = address?.street || address?.address || undefined;
        cityStr = address?.city || undefined;
      } catch {
        addressStr = undefined;
        cityStr = undefined;
      }
    }
    
    // Extract segment name
    let segmentName: string | undefined;
    if (company.segment_names) {
      try {
        const segments = typeof company.segment_names === 'string' ? JSON.parse(company.segment_names) : company.segment_names;
        segmentName = Array.isArray(segments) && segments.length > 0 ? segments[0] : undefined;
      } catch {
        segmentName = undefined;
      }
    }
    
    // Get financial data from metrics and account_codes
    // latest_*_sek values are in SEK (from account_codes)
    // For display: convert to thousands (divide by 1000)
    // For margin calculation: use original SEK values to avoid precision issues
    
    // Get EBIT (RG) from account_codes - this is the correct field for EBIT margin
    let ebit_sek: number | undefined;
    if (row.company_financials && Array.isArray(row.company_financials) && row.company_financials.length > 0) {
      const financials = row.company_financials[0];
      if (financials.account_codes && financials.account_codes.RG) {
        ebit_sek = typeof financials.account_codes.RG === 'string' 
          ? parseFloat(financials.account_codes.RG) 
          : financials.account_codes.RG;
      }
    }
    
    const revenue_thousands = row.latest_revenue_sek ? row.latest_revenue_sek / 1000 : undefined;
    const profit_thousands = row.latest_profit_sek ? row.latest_profit_sek / 1000 : undefined;
    const ebit_thousands = ebit_sek ? ebit_sek / 1000 : undefined;
    
    // Calculate margins using original SEK values (more accurate)
    // EBIT Margin = (EBIT / Revenue) * 100 to get percentage
    // Use RG (EBIT) from account_codes, NOT EBITDA
    const ebitMargin = row.latest_revenue_sek && ebit_sek && row.latest_revenue_sek > 0
      ? (ebit_sek / row.latest_revenue_sek) * 100
      : null;
    const profitMargin = row.latest_revenue_sek && row.latest_profit_sek && row.latest_revenue_sek > 0
      ? (row.latest_profit_sek / row.latest_revenue_sek) * 100
      : null;
    const growth = row.revenue_cagr_3y ? row.revenue_cagr_3y / 100 : null;

    return {
      OrgNr: company.orgnr,
      name: company.company_name || 'Unknown Company',
      address: addressStr,
      city: cityStr,
      incorporation_date: company.foundation_year ? `${company.foundation_year}-01-01` : undefined,
      email: company.email || undefined,
      homepage: company.homepage || undefined,
      segment: segmentName,
      segment_name: segmentName,
      industry_name: segmentName,
      revenue: revenue_thousands !== undefined ? revenue_thousands.toString() : undefined,
      profit: profit_thousands !== undefined ? profit_thousands.toString() : undefined,
      employees: company.employees_latest?.toString() || undefined,
      SDI: revenue_thousands,
      DR: profit_thousands,
      ORS: ebit_thousands,
      RG: ebit_thousands,
      Revenue_growth: growth ?? undefined,
      // formatPercent multiplies by 100, so pass decimal (0.0798 = 7.98%)
      // ebitMargin is already percentage (7.98), so divide by 100 to get decimal
      EBIT_margin: ebitMargin !== null ? ebitMargin / 100 : undefined,
      NetProfit_margin: profitMargin !== null ? profitMargin / 100 : undefined,
      year: undefined, // Not needed for list view
      fit_score: row.fit_score,
      ops_upside_score: row.ops_upside_score,
      nivo_total_score: row.nivo_total_score,
      segment_tier: row.segment_tier,
    };
  };

  const tier1 = (tier1Result.data || [])
    .map(transformToCompany)
    .filter((c): c is SupabaseCompany => c !== null);

  const tier2 = (tier2Result.data || [])
    .map(transformToCompany)
    .filter((c): c is SupabaseCompany => c !== null);

  const tier3 = (tier3Result.data || [])
    .map(transformToCompany)
    .filter((c): c is SupabaseCompany => c !== null);

  if (tier1Result.error) {
    console.error('Error fetching Tier 1 companies:', tier1Result.error);
  }
  if (tier2Result.error) {
    console.error('Error fetching Tier 2 companies:', tier2Result.error);
  }
  if (tier3Result.error) {
    console.error('Error fetching Tier 3 companies:', tier3Result.error);
  }

  return { tier1, tier2, tier3 };
}

/**
 * Get segmentation statistics (counts per tier)
 * Uses efficient COUNT queries with timeout handling
 */
export async function getSegmentationStats(): Promise<{
  tier1: number;
  tier2: number;
  tier3: number;
  unsegmented: number;
  total: number;
}> {
  // Use separate COUNT queries for each tier with error handling
  // If queries timeout, return known values (100 per tier)
  try {
    const [tier1Result, tier2Result, tier3Result] = await Promise.all([
      supabase.from('company_metrics').select('orgnr', { count: 'exact', head: true }).eq('segment_tier', '1'),
      supabase.from('company_metrics').select('orgnr', { count: 'exact', head: true }).eq('segment_tier', '2'),
      supabase.from('company_metrics').select('orgnr', { count: 'exact', head: true }).eq('segment_tier', '3'),
    ]);

    // If any query fails, use fallback values
    if (tier1Result.error || tier2Result.error || tier3Result.error) {
      console.warn('Error fetching segmentation stats, using fallback values:', {
        tier1: tier1Result.error,
        tier2: tier2Result.error,
        tier3: tier3Result.error,
      });
      // Return known values (100 per tier from segmentation function)
      return {
        tier1: 100,
        tier2: 100,
        tier3: 100,
        unsegmented: 0,
        total: 300,
      };
    }

    const tier1 = tier1Result.count || 100;
    const tier2 = tier2Result.count || 100;
    const tier3 = tier3Result.count || 100;
    const total = tier1 + tier2 + tier3;
    const unsegmented = 0; // We don't need this for display

    return {
      tier1,
      tier2,
      tier3,
      unsegmented,
      total,
    };
  } catch (error) {
    console.error('Error fetching segmentation stats:', error);
    // Return fallback values on any error
    return {
      tier1: 100,
      tier2: 100,
      tier3: 100,
      unsegmented: 0,
      total: 300,
    };
  }
}

/**
 * Refresh segmentation scores (calls the database function)
 * Note: This requires appropriate database permissions
 */
export async function refreshSegmentationScores(): Promise<void> {
  const { error } = await supabase.rpc('calculate_segmentation_scores');

  if (error) {
    console.error('Error refreshing segmentation scores:', error);
    throw error;
  }
}

