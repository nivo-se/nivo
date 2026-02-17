/**
 * Helpers for Figma Company type - compatible with figmaApi / universe data.
 * Nullable numerics are preserved as null; use format* for display.
 */
import type { Company } from "@/types/figma";
import type { FinancialYear } from "@/lib/services/figmaApi";

export function calculateRevenueCagr(company: Company, _years = 3): number | null {
  return company.revenue_cagr_3y ?? null;
}

export function getLatestFinancials(company: Company) {
  const rev = company.revenue_latest ?? null;
  const margin = company.ebitda_margin_latest ?? null;
  return {
    revenue: rev,
    ebitda: company.ebitda_latest ?? (rev != null && margin != null ? rev * margin : null),
    ebitdaMargin: margin,
    revenue_cagr: company.revenue_cagr_3y ?? null,
  };
}

/** Derive latest revenue, ebitda margin, and 3Y CAGR from raw financials (from /api/companies/{orgnr}/financials). */
export function deriveFinancialsFromYears(financials: FinancialYear[]): {
  revenue: number | null;
  ebitdaMargin: number | null;
  revenue_cagr: number | null;
} {
  if (!financials?.length) return { revenue: null, ebitdaMargin: null, revenue_cagr: null };
  const latest = financials[0];
  const rev = latest.revenue_sek ?? null;
  const margin = latest.ebitda_margin != null ? latest.ebitda_margin / 100 : null; // API returns %, we use 0..1
  let cagr: number | null = null;
  if (financials.length >= 2) {
    const newest = financials[0].revenue_sek ?? 0;
    const oldest = financials[financials.length - 1].revenue_sek ?? 0;
    const years = (financials[0].year - financials[financials.length - 1].year) || 1;
    if (oldest > 0 && newest > 0) {
      cagr = (Math.pow(newest / oldest, 1 / years) - 1);
    }
  }
  return { revenue: rev, ebitdaMargin: margin, revenue_cagr: cagr };
}

/** Format number for display; returns "—" for null/NaN. */
export function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(value);
}

/** Format SEK millions; returns "—" for null/NaN. */
export function formatRevenueSEK(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value / 1_000_000).toFixed(1)}M SEK`;
}

/** Format percent (0.12 → 12%); returns "—" for null/NaN. */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}
