/**
 * Builds the CompanyOverviewModel from company (batch/universe) and financials API data.
 * Applies Latest FY selection and derives metrics from financials when possible.
 */
import type { Company } from "@/lib/api/types";
import type { CompanyOverviewModel } from "@/lib/api/companies/types";

/** Raw financial year from API - margins may be 0-100 or 0-1. */
type RawFinancialRow = {
  year: number;
  revenue_sek?: number | null;
  revenue?: number | null;
  ebitda_sek?: number | null;
  ebitda?: number | null;
  ebit_sek?: number | null;
  ebit?: number | null;
  profit_sek?: number | null;
  profit?: number | null;
  net_margin?: number | null;
  ebit_margin?: number | null;
  ebitda_margin?: number | null;
};

/** Normalize margin to 0–1 (API may return 0–100). */
function toMargin01(val: number | null | undefined): number | null {
  if (val === null || val === undefined || Number.isNaN(val)) return null;
  const v = Number(val);
  return v > 1 ? v / 100 : v;
}

/** Latest FY: backend returns year DESC, prefer full-year (12 or 1-12). First row is latest. */
function selectLatestFY(rows: RawFinancialRow[]): RawFinancialRow | null {
  if (!rows?.length) return null;
  return rows[0];
}

/** Compute YoY growth. Returns ratio (e.g. 0.15 = 15%). */
function yoyGrowth(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev;
}

/** Compute CAGR over n years. */
function cagr( newest: number, oldest: number, years: number ): number | null {
  if (oldest <= 0 || newest <= 0 || years <= 0) return null;
  return Math.pow(newest / oldest, 1 / years) - 1;
}

export function buildCompanyOverviewModel(
  company: Company | null,
  financialsData: { financials?: RawFinancialRow[] } | null
): CompanyOverviewModel {
  const raw = financialsData?.financials ?? [];
  const latestFY = selectLatestFY(raw);

  const rev = (r: RawFinancialRow) => r?.revenue_sek ?? r?.revenue ?? null;
  const ebitdaVal = (r: RawFinancialRow) => r?.ebitda_sek ?? r?.ebitda ?? null;
  const ebitVal = (r: RawFinancialRow) => r?.ebit_sek ?? r?.ebit ?? null;
  const profitVal = (r: RawFinancialRow) => r?.profit_sek ?? r?.profit ?? null;

  const sourceMap: Record<string, "financials" | "kpis" | "company"> = {};

  // Latest FY snapshot
  const year = latestFY?.year ?? company?.latest_year ?? new Date().getFullYear() - 1;
  const revenue =
    rev(latestFY!) ??
    company?.revenue_latest ??
    null;
  const ebitda =
    ebitdaVal(latestFY!) ??
    company?.ebitda_latest ??
    (revenue != null && company?.ebitda_margin_latest != null
      ? revenue * company.ebitda_margin_latest
      : null);
  const ebit = ebitVal(latestFY!) ?? company?.ebit_latest ?? null;
  const profit = profitVal(latestFY!) ?? null;

  if (latestFY) {
    sourceMap.revenue = rev(latestFY) != null ? "financials" : "company";
    sourceMap.ebitda = ebitdaVal(latestFY) != null ? "financials" : "company";
    sourceMap.ebit = ebit != null ? "financials" : "company";
    sourceMap.profit = profit != null ? "financials" : "company";
  } else {
    sourceMap.revenue = "company";
    sourceMap.ebitda = "company";
    sourceMap.ebit = "company";
    sourceMap.profit = "company";
  }

  const ebitdaMargin =
    toMargin01(latestFY?.ebitda_margin) ??
    company?.ebitda_margin_latest ??
    (revenue != null && revenue > 0 && ebitda != null ? ebitda / revenue : null);
  const ebitMargin =
    toMargin01(latestFY?.ebit_margin) ??
    company?.ebit_margin_latest ??
    (revenue != null && revenue > 0 && ebit != null ? ebit / revenue : null);
  const netMargin =
    toMargin01(latestFY?.net_margin) ??
    (revenue != null && revenue > 0 && profit != null ? profit / revenue : null);

  if (latestFY?.ebitda_margin != null || latestFY?.ebit_margin != null || latestFY?.net_margin != null) {
    sourceMap.ebitdaMargin = "financials";
    sourceMap.ebitMargin = "financials";
    sourceMap.netMargin = "financials";
  } else {
    sourceMap.ebitdaMargin = "company";
    sourceMap.ebitMargin = "company";
    sourceMap.netMargin = profit != null && revenue != null ? "financials" : "company";
  }

  // Growth
  let yoyRevenue: number | null = null;
  let yoyEbitda: number | null = null;
  if (raw.length >= 2) {
    yoyRevenue = yoyGrowth(rev(raw[0]), rev(raw[1]));
    yoyEbitda = yoyGrowth(ebitdaVal(raw[0]), ebitdaVal(raw[1]));
  }
  yoyRevenue = yoyRevenue ?? company?.revenue_growth_yoy_latest ?? null;
  sourceMap.yoyRevenue = raw.length >= 2 ? "financials" : "company";
  sourceMap.yoyEbitda = raw.length >= 2 ? "financials" : "company";

  const r0 = rev(raw[0]);
  const r3 = raw.length >= 4 ? rev(raw[3]) : null;
  const r5 = raw.length >= 6 ? rev(raw[5]) : null;
  const cagr3y =
    r0 != null && r3 != null
      ? cagr(r0, r3, Math.min(3, raw[0].year - raw[3].year))
      : company?.revenue_cagr_3y ?? null;
  const cagr5y =
    r0 != null && r5 != null
      ? cagr(r0, r5, Math.min(5, raw[0].year - raw[5].year))
      : (company as { revenue_cagr_5y?: number | null })?.revenue_cagr_5y ?? null;
  sourceMap.cagr3y = raw.length >= 4 ? "financials" : "company";
  sourceMap.cagr5y = raw.length >= 6 ? "financials" : "company";

  // Efficiency
  const emp = company?.employees_latest ?? null;
  const revenuePerEmployee =
    emp != null && emp > 0 && revenue != null ? revenue / emp : null;
  const ebitdaPerEmployee =
    emp != null && emp > 0 && ebitda != null ? ebitda / emp : null;
  sourceMap.revenuePerEmployee = revenuePerEmployee != null ? "financials" : "company";
  sourceMap.ebitdaPerEmployee = ebitdaPerEmployee != null ? "financials" : "company";

  // Balance
  const equityRatio = company?.equity_ratio_latest ?? null;
  const debtToEquity = company?.debt_to_equity_latest ?? null;
  sourceMap.equityRatio = "company";
  sourceMap.debtToEquity = "company";

  // Series (last 4–6 years, normalized)
  const series = raw.slice(0, 6).map((r) => ({
    year: r.year,
    revenue: rev(r),
    ebitda: ebitdaVal(r),
    ebit: ebitVal(r),
    profit: profitVal(r),
  }));

  return {
    latestFY: {
      year,
      revenue,
      ebitda,
      ebit,
      profit,
      ebitdaMargin,
      ebitMargin,
      netMargin,
    },
    growth: { yoyRevenue, yoyEbitda, cagr3y, cagr5y },
    efficiency: { revenuePerEmployee, ebitdaPerEmployee },
    balance: { equityRatio, debtToEquity },
    series,
    sourceMap,
  };
}
