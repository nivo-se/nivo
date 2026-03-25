import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authToken";

export type ScreeningShortlistRow = {
  company_name: string | null;
  orgnr: string;
  layer1_rank: number | null;
  layer1_score: number | null;
  layer2_fit_confidence: number | null;
  confidence_bucket: string;
  homepage_used: string;
  top_domain: string;
  layer2_reason_summary: string;
};

export type ScreeningRunMeta = {
  run_id: string;
  created_at: string | null;
  run_kind: string | null;
};

export type ScreeningShortlistStats = {
  fit_true_count_in_run: number;
};

export type ScreeningShortlistResponse = {
  run_id: string;
  run: ScreeningRunMeta | null;
  is_latest_persisted_run: boolean;
  stats: ScreeningShortlistStats;
  count: number;
  rows: ScreeningShortlistRow[];
};

export type LatestScreeningRunResponse = {
  id: string;
  created_at: string | null;
};

/** Readable message from FastAPI JSON error bodies. */
function httpErrorMessage(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
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

function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export async function fetchScreeningRunShortlist(
  runId: string,
  options: {
    confidence_bucket?: string;
    min_fit_confidence?: number;
    q?: string;
  } = {}
): Promise<ScreeningShortlistResponse> {
  const q = qs({
    confidence_bucket: options.confidence_bucket,
    min_fit_confidence: options.min_fit_confidence,
    q: options.q,
  });
  const url = `${API_BASE}/api/screening-runs/${encodeURIComponent(runId)}/shortlist${q}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(httpErrorMessage(t, res.status));
  }
  return res.json() as Promise<ScreeningShortlistResponse>;
}

export async function fetchLatestScreeningRun(): Promise<LatestScreeningRunResponse> {
  const url = `${API_BASE}/api/screening-runs/latest`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(httpErrorMessage(t, res.status));
  }
  return res.json() as Promise<LatestScreeningRunResponse>;
}

/** CSV export uses raw fetch so we do not force application/json Content-Type on GET. */
export async function downloadScreeningRunShortlistCsv(
  runId: string,
  options: {
    confidence_bucket?: string;
    min_fit_confidence?: number;
    q?: string;
  } = {}
): Promise<Blob> {
  const q = qs({
    confidence_bucket: options.confidence_bucket,
    min_fit_confidence: options.min_fit_confidence,
    q: options.q,
  });
  const url = `${API_BASE}/api/screening-runs/${encodeURIComponent(runId)}/shortlist/export${q}`;
  const headers: Record<string, string> = {};
  try {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.blob();
}
