import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export type EnrichmentRunResponse = {
  runId: string;
  queuedCount: number;
  jobId?: string | null;
};

/** Row from GET /api/enrichment/runs (stored in `enrichment_runs`). */
export type EnrichmentRunSummary = {
  runId: string;
  createdAt?: string | null;
  source?: string | null;
  campaignId?: string | null;
  queuedCount?: number | null;
};

export type EnrichmentRunStatus = {
  run_id: string;
  counts_by_kind: Record<string, number>;
  completed: number;
  failed: number;
  /** Orgs still processing (worker not finished); not the same as failures */
  pending?: number;
  /** Companies skipped because ai_profile already existed (no force_refresh). */
  skipped?: number;
  failures: unknown[];
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * Batch public / LLM enrichment for all orgnrs in a screening campaign
 * (excludes candidates marked excluded_from_analysis when DB supports it).
 * Work always runs on the API server; `syncRun` only chooses in-process vs RQ there.
 */
export async function runEnrichmentForScreeningCampaign(
  campaignId: string,
  kinds?: string[],
  options?: { syncRun?: boolean }
): Promise<EnrichmentRunResponse> {
  const syncRun =
    options?.syncRun === true ||
    (typeof import.meta.env.VITE_ENRICHMENT_SYNC_RUN === "string" &&
      import.meta.env.VITE_ENRICHMENT_SYNC_RUN.toLowerCase() === "true");
  const res = await fetchWithAuth(`${API_BASE}/api/enrichment/run`, {
    method: "POST",
    body: JSON.stringify({
      campaignId,
      ...(kinds?.length ? { kinds } : {}),
      ...(syncRun ? { syncRun: true } : {}),
    }),
  });
  const data = await parseJson<{ run_id: string; queued_count: number; job_id?: string | null }>(res);
  return {
    runId: data.run_id,
    queuedCount: data.queued_count,
    jobId: data.job_id ?? null,
  };
}

/** List enrichment runs, optionally filtered to a screening campaign (meta.campaign_id). */
export async function listEnrichmentRuns(options: {
  campaignId?: string;
  limit?: number;
}): Promise<EnrichmentRunSummary[]> {
  const p = new URLSearchParams();
  if (options.campaignId) p.set("campaignId", options.campaignId);
  if (options.limit != null) p.set("limit", String(options.limit));
  const qs = p.toString();
  const res = await fetchWithAuth(`${API_BASE}/api/enrichment/runs${qs ? `?${qs}` : ""}`);
  const data = await parseJson<{ items: EnrichmentRunSummary[] }>(res);
  return data.items ?? [];
}

export async function getEnrichmentRunStatus(runId: string): Promise<EnrichmentRunStatus | null> {
  const res = await fetchWithAuth(`${API_BASE}/api/enrichment/run/${encodeURIComponent(runId)}/status`);
  if (!res.ok) return null;
  return parseJson<EnrichmentRunStatus>(res);
}
