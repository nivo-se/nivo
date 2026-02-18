import type { AIProfile, Company, FinancialYear } from "@/lib/api/types";

/** Normalized overview model for Company Detail. All monetary values in SEK. Margins 0–1. */
export type CompanyOverviewModel = {
  latestFY: {
    year: number;
    period?: string;
    revenue: number | null;
    ebitda: number | null;
    ebit: number | null;
    profit: number | null;
    ebitdaMargin: number | null;
    ebitMargin: number | null;
    netMargin: number | null;
  };
  growth: {
    yoyRevenue: number | null;
    yoyEbitda: number | null;
    cagr3y: number | null;
    cagr5y: number | null;
  };
  efficiency: {
    revenuePerEmployee: number | null;
    ebitdaPerEmployee: number | null;
  };
  balance: {
    equityRatio: number | null;
    debtToEquity: number | null;
  };
  series: Array<{
    year: number;
    revenue: number | null;
    ebitda: number | null;
    ebit: number | null;
    profit: number | null;
  }>;
  sourceMap?: Record<string, "financials" | "kpis" | "company">;
};

export type CompanySummary = Company;
export type CompanyDetail = Company;
export type CompanyAnalysisProfile = AIProfile;

export interface CompaniesBatchOptions {
  autoEnrich?: boolean;
}

export interface FullFinancialLineItem {
  key: string;
  label_sv: string;
  section: string;
  bold: boolean;
  source: "core" | "account_codes" | "derived";
  years: Record<string, number | null>;
}

export interface FullFinancials {
  pnl: FullFinancialLineItem[];
  balance: FullFinancialLineItem[];
}

export interface CompanyFinancialsResponse {
  financials: FinancialYear[];
  count: number;
  full?: FullFinancials | null;
}
