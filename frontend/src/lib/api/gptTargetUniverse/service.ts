import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export type GptTargetCompanyRow = {
  orgnr: string;
  company_name: string | null;
  rank: number | null;
  gpt_official_website_url: string | null;
  about_fetch_status: string | null;
  llm_triage_at: string | null;
  is_fit_for_nivo: boolean | null;
  fit_confidence: number | null;
  blended_score: number | null;
  stage1_total_score: number | null;
  business_type: string | null;
  operating_model: string | null;
  reason_summary: string | null;
  triage: Record<string, unknown> | null;
};

export type GptTargetCompaniesResponse = {
  run_id: string;
  total: number;
  rows: GptTargetCompanyRow[];
};

function httpErrorMessage(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown; error?: unknown };
    if (status === 401 && j.error === "unauthorized") {
      return "Unauthorized (401): sign in again, or the access token is missing or rejected. With REQUIRE_AUTH=true the API expects a valid Auth0 Bearer token (same audience as the backend).";
    }
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item: unknown) =>
          item && typeof item === "object" && "msg" in item ? String((item as { msg: string }).msg) : JSON.stringify(item)
        )
        .join("; ");
    }
    if (d != null && typeof d === "object") return JSON.stringify(d);
  } catch {
    /* use raw */
  }
  return trimmed;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export type FetchGptTargetCompaniesOptions = {
  /** When set, overrides GPT_TARGET_UNIVERSE_RUN_ID for this request. */
  run_id?: string;
  q?: string;
  fit?: boolean;
  has_triage?: boolean;
  min_fit_confidence?: number;
};

export type GptTargetUniverseMeta = {
  database_source_postgres: boolean;
  env_run_id_set: boolean;
  run_id: string | null;
  /** query_param | environment | auto_latest | none | invalid_query | invalid_env */
  run_id_resolution?: string | null;
  run_id_parse_error: string | null;
  table_screening_website_research_companies: boolean;
  table_check_error: string | null;
  row_count: number | null;
  row_count_error: string | null;
};

export type GptTargetRunOption = {
  run_id: string;
  run_kind: string;
  created_at: string;
  row_count: number;
};

export async function fetchGptTargetUniverseMeta(runId?: string): Promise<GptTargetUniverseMeta> {
  const q = qs({ run_id: runId?.trim() || undefined });
  const url = `${API_BASE}/api/gpt-target-universe/meta${q}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(httpErrorMessage(t, res.status));
  }
  return res.json() as Promise<GptTargetUniverseMeta>;
}

export async function fetchGptTargetUniverseRuns(): Promise<GptTargetRunOption[]> {
  const url = `${API_BASE}/api/gpt-target-universe/runs`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(httpErrorMessage(t, res.status));
  }
  return res.json() as Promise<GptTargetRunOption[]>;
}

export async function fetchGptTargetUniverseCompanies(
  options: FetchGptTargetCompaniesOptions = {}
): Promise<GptTargetCompaniesResponse> {
  const q = qs({
    run_id: options.run_id?.trim() || undefined,
    q: options.q?.trim() || undefined,
    fit: options.fit === undefined ? undefined : options.fit,
    has_triage: options.has_triage === undefined ? undefined : options.has_triage,
    min_fit_confidence: options.min_fit_confidence,
  });
  const url = `${API_BASE}/api/gpt-target-universe/companies${q}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(httpErrorMessage(t, res.status));
  }
  return res.json() as Promise<GptTargetCompaniesResponse>;
}
