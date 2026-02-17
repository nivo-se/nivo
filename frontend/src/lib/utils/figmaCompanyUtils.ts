/**
 * Helpers for Figma Company type - compatible with figmaApi / universe data.
 * Nullable numerics are preserved as null; use format* for display.
 */
import type { Company } from "@/types/figma";

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
