import {
  getUniverseFiltersClient,
  queryUniverseClient,
} from "@/lib/api/universe/client";
import type { Company } from "@/lib/api/types";
import type { UniverseCompaniesResponse, UniverseQuery } from "@/lib/api/universe/types";
import type { UniverseRow } from "@/lib/services/universeQueryService";

function toNull<T>(v: T | null | undefined): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  return v;
}

function mapUniverseRowToCompany(row: UniverseRow): Company {
  const aiFit = row.ai_strategic_fit_score;
  const aiBadge =
    aiFit != null
      ? aiFit >= 7
        ? "Strong"
        : aiFit >= 5
          ? "Neutral"
          : aiFit >= 1
            ? "Weak"
            : null
      : null;
  const segmentNames = row.segment_names ?? [];

  return {
    orgnr: String(row.orgnr ?? ""),
    display_name: row.name ?? row.orgnr ?? "",
    legal_name: row.name ?? row.orgnr ?? "",
    industry_label: Array.isArray(segmentNames) ? segmentNames[0] ?? "Unknown" : "Unknown",
    segment_names: Array.isArray(segmentNames) ? segmentNames : null,
    has_homepage: Boolean(row.has_homepage),
    has_ai_profile: Boolean(row.has_ai_profile),
    has_3y_financials: Boolean(row.has_3y_financials),
    data_quality_score: toNull(row.data_quality_score),
    is_stale: Boolean(row.is_stale),
    last_enriched_at: row.last_enriched_at ?? undefined,
    revenue_latest: toNull(row.revenue_latest),
    ebitda_margin_latest: toNull(row.ebitda_margin_latest),
    revenue_cagr_3y: toNull(row.revenue_cagr_3y),
    employees_latest: toNull(row.employees_latest),
    region: row.municipality ? String(row.municipality) : undefined,
    website_url: row.homepage ? String(row.homepage) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    ai_profile: row.has_ai_profile
      ? { ai_fit_score: aiFit ?? undefined, ai_badge: aiBadge ?? undefined }
      : undefined,
    equity_ratio_latest: toNull(row.equity_ratio_latest),
    debt_to_equity_latest: toNull(row.debt_to_equity_latest),
    currency: "SEK",
    years_available: 0,
    latest_year: new Date().getFullYear(),
    status: "active",
    financials: [],
  };
}

export async function getUniverseCompanies(
  payload?: UniverseQuery,
  signal?: AbortSignal
): Promise<Company[]> {
  const { companies } = await getUniverseCompaniesWithTotal(payload, signal);
  return companies;
}

export async function getUniverseCompaniesWithTotal(
  payload?: UniverseQuery,
  signal?: AbortSignal
): Promise<UniverseCompaniesResponse> {
  const result = await queryUniverseClient(
    {
      filters: payload?.filters ?? [],
      logic: "and",
      sort: payload?.sort ?? { by: "data_quality_score", dir: "asc" },
      limit: payload?.limit ?? 500,
      offset: payload?.offset ?? 0,
      q: payload?.q,
    },
    signal
  );

  return {
    companies: result.rows.map((r) => mapUniverseRowToCompany(r as UniverseRow)),
    total: result.total,
  };
}

export async function getUniverseFilters(): Promise<Awaited<ReturnType<typeof getUniverseFiltersClient>>> {
  return getUniverseFiltersClient();
}
