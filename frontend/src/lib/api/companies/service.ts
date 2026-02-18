import {
  getCompaniesBatchClient,
  getCompanyAnalysisClient,
  getCompanyFinancialsClient,
} from "@/lib/api/companies/client";
import type { Company } from "@/lib/api/types";
import type {
  CompaniesBatchOptions,
  CompanyAnalysisProfile,
  CompanyFinancialsResponse,
} from "@/lib/api/companies/types";
import { getUniverseCompaniesWithTotal } from "@/lib/api/universe/service";

function toNull<T>(v: T | null | undefined): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  return v;
}

function mapBatchRowToCompany(row: Record<string, unknown>): Company {
  const rev = row.latest_revenue_sek;
  const margin = row.avg_ebitda_margin;
  const seg = row.segment_names;
  const segArr = Array.isArray(seg) ? seg : seg ? [String(seg)] : [];
  const homepage = row.homepage ? String(row.homepage) : undefined;
  const email = row.email ? String(row.email) : undefined;
  const phone = row.phone ? String(row.phone) : undefined;

  return {
    orgnr: String(row.orgnr ?? ""),
    display_name: String(row.company_name ?? row.orgnr ?? ""),
    legal_name: String(row.company_name ?? row.orgnr ?? ""),
    industry_label: segArr[0] ? String(segArr[0]) : "Unknown",
    region: row.region ? String(row.region) : undefined,
    website_url: homepage,
    email,
    phone,
    revenue_latest: toNull(typeof rev === "number" ? rev : null),
    ebitda_margin_latest: toNull(typeof margin === "number" ? margin : null),
    revenue_cagr_3y: toNull(row.revenue_cagr_3y as number | null),
    employees_latest: toNull(row.employees_latest as number | null),
    equity_ratio_latest: toNull(row.equity_ratio_latest as number | null),
    debt_to_equity_latest: toNull(row.debt_to_equity_latest as number | null),
    leverage_ratio:
      typeof row.debt_to_equity_latest === "number"
        ? row.debt_to_equity_latest
        : undefined,
    data_quality_score: null,
    has_homepage: Boolean(row.homepage),
    has_ai_profile: Boolean(row.ai_strategic_score != null),
    has_3y_financials: true,
    is_stale: false,
    currency: "SEK",
    years_available: 0,
    latest_year: new Date().getFullYear(),
    status: "active",
    financials: [],
  };
}

export async function getCompanyByOrgnr(
  orgnr: string,
  signal?: AbortSignal
): Promise<Company | null> {
  const result = await getUniverseCompaniesWithTotal(
    {
      q: orgnr.trim(),
      limit: 1,
      sort: { by: "orgnr", dir: "asc" },
    },
    signal
  );
  const row = result.companies[0];
  if (!row || row.orgnr !== orgnr) return null;
  return row;
}

export async function searchCompanySummaries(
  query: string,
  limit = 50,
  signal?: AbortSignal
): Promise<Company[]> {
  if (!query.trim()) return [];
  const result = await getUniverseCompaniesWithTotal(
    { q: query.trim(), limit, sort: { by: "data_quality_score", dir: "asc" } },
    signal
  );
  return result.companies;
}

export async function getCompaniesBatchDetails(
  orgnrs: string[],
  options?: CompaniesBatchOptions
): Promise<Company[]> {
  if (orgnrs.length === 0) return [];
  const res = await getCompaniesBatchClient(orgnrs, options);
  return (res.companies ?? []).map((row) => mapBatchRowToCompany(row));
}

export async function getCompanyFinancialHistory(
  orgnr: string
): Promise<CompanyFinancialsResponse> {
  const res = await getCompanyFinancialsClient(orgnr);
  return {
    financials: res.financials ?? [],
    count: res.count ?? 0,
    full: res.full ?? null,
  };
}

export async function getCompanyAnalysisProfile(
  orgnr: string
): Promise<CompanyAnalysisProfile | null> {
  try {
    const row = await getCompanyAnalysisClient(orgnr);
    return {
      company_orgnr: orgnr,
      ai_fit_score: Number(row.strategic_fit_score ?? 0),
      last_analyzed: new Date().toISOString(),
      analysis_count: 1,
      latest_result: {
        id: `unknown::${orgnr}`,
        run_id: "unknown",
        company_orgnr: orgnr,
        status: "pending",
        overall_score: Number(row.strategic_fit_score ?? 0),
        dimension_scores: {},
        summary: String(row.investment_memo ?? ""),
        strengths: Array.isArray(row.swot_strengths) ? row.swot_strengths.map(String) : [],
        concerns: Array.isArray(row.swot_weaknesses) ? row.swot_weaknesses.map(String) : [],
        recommendation: "potential_fit",
        prompt_used: "",
        tokens_used: 0,
        cost: 0,
        analyzed_at: new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}
