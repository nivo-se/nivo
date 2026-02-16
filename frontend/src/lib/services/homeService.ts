import { fetchWithAuth } from "@/lib/backendFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export type TimeRange = "1d" | "7d" | "30d";

export type HomeDashboard = {
  universe: {
    total_companies: number;
    matched: number | null;
    added_7d: number | null;
    updated_7d: number | null;
  };
  pipeline: {
    team_lists_count: number | null;
    my_lists_count: number | null;
    last_updated_lists: {
      id: string;
      name: string;
      scope: string;
      updated_at: string;
    }[];
  };
  coverage: {
    total_companies: number;
    ai_profile_pct: number | null;
    financial_3y_pct: number | null;
    stale_pct: number | null;
    avg_data_quality: number | null;
  };
  runs: {
    active_runs: number | null;
    failed_count: number | null;
  };
  status: {
    db_ok: boolean;
    api: string;
    counts?: Record<string, number>;
  };
  analytics?: {
    enrichment_activity: number | null;
    shortlist_activity: number | null;
    views_activity: number | null;
  };
  chart_series?: { date: string; value: number; label: string }[];
};

export async function getHomeDashboard(range?: TimeRange): Promise<HomeDashboard> {
  const usp = new URLSearchParams();
  if (range) usp.set("range", range);
  const url = `${API_BASE}/api/home/dashboard${usp.toString() ? `?${usp.toString()}` : ""}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}
