import { fetchWithAuth } from "@/lib/backendFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export type FilterTaxonomyGroup = {
  id: string;
  label: string;
  items: FilterTaxonomyItem[];
};

export type FilterTaxonomyItem = {
  field: string;
  label: string;
  type: "number" | "percent" | "boolean" | "text";
  ops: string[];
  unit?: string;
};

export type FilterTaxonomy = {
  groups: FilterTaxonomyGroup[];
};

export type FilterItem = {
  field: string;
  op: string;
  value: unknown;
  type: string;
};

export type UniverseQueryPayload = {
  filters: FilterItem[];
  logic?: "and";
  sort?: { by?: string; dir?: "asc" | "desc" };
  limit?: number;
  offset?: number;
  q?: string;
};

export type UniverseRow = {
  orgnr: string;
  name?: string | null;
  segment_names?: string[] | null;
  has_homepage: boolean;
  has_ai_profile: boolean;
  has_3y_financials: boolean;
  last_enriched_at?: string | null;
  is_stale: boolean;
  data_quality_score: number;
  revenue_latest?: number | null;
  ebitda_margin_latest?: number | null;
  revenue_cagr_3y?: number | null;
  employees_latest?: number | null;
  municipality?: string | null;
  homepage?: string | null;
  email?: string | null;
  phone?: string | null;
  ai_strategic_fit_score?: number | null;
  equity_ratio_latest?: number | null;
  debt_to_equity_latest?: number | null;
};

export type UniverseQueryResponse = {
  rows: UniverseRow[];
  total: number;
};

export async function getUniverseFilters(): Promise<FilterTaxonomy> {
  const res = await fetchWithAuth(`${API_BASE}/api/universe/filters`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Sign in required to load filters");
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = String(body.detail || body.message || msg).slice(0, 150);
    } catch {
      msg = res.statusText;
    }
    throw new Error(`Failed to fetch filters: ${msg}`);
  }
  return res.json();
}

export async function queryUniverse(
  payload: UniverseQueryPayload,
  signal?: AbortSignal
): Promise<UniverseQueryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/universe/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: payload.filters ?? [],
      logic: payload.logic ?? "and",
      sort: payload.sort ?? {},
      limit: payload.limit ?? 50,
      offset: payload.offset ?? 0,
      q: payload.q ?? undefined,
    }),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Sign in required to query universe");
    let msg: string = res.statusText;
    try {
      const body = await res.json();
      msg = String(body?.detail ?? body?.message ?? msg).slice(0, 150);
    } catch {
      // Body already consumed or invalid JSON
    }
    throw new Error(msg || "Failed to query universe");
  }
  return res.json();
}
