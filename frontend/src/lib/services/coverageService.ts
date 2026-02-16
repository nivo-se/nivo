import { fetchWithAuth } from "@/lib/backendFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export type CoverageSnapshot = {
  total_companies: number;
  has_homepage_pct: number;
  has_ai_profile_pct: number;
  has_3y_financials_pct: number;
  stale_pct: number;
  avg_data_quality_score: number;
};

export type CoverageRow = {
  orgnr: string;
  name?: string | null;
  segment_names?: string[] | null;
  has_homepage: boolean;
  has_ai_profile: boolean;
  has_3y_financials: boolean;
  last_enriched_at?: string | null;
  is_stale: boolean;
  data_quality_score: number;
};

export type CoverageListResponse = {
  rows: CoverageRow[];
  total: number;
};

export async function getCoverageSnapshot(): Promise<CoverageSnapshot> {
  const res = await fetchWithAuth(`${API_BASE}/api/coverage/snapshot`);
  if (!res.ok) throw new Error("Failed to fetch coverage snapshot");
  return res.json();
}

export async function getCoverageList(params: {
  q?: string;
  segment?: string;
  missing_homepage?: boolean;
  missing_ai?: boolean;
  missing_3y?: boolean;
  stale_only?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CoverageListResponse> {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.set(k, String(v));
  });

  const res = await fetchWithAuth(
    `${API_BASE}/api/coverage/list?${usp.toString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch coverage list");
  return res.json();
}
