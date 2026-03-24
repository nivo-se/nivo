import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";
import type {
  CreateCampaignPayload,
  ScreeningCampaignCandidate,
  ScreeningCampaignSummary,
} from "./types";

/** Readable message from FastAPI / generic JSON error bodies. */
function errorBodyToMessage(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item: unknown) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: string }).msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
    if (d != null && typeof d === "object") return JSON.stringify(d);
  } catch {
    /* use raw text */
  }
  return trimmed;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(errorBodyToMessage(text, res.status));
  }
  return res.json() as Promise<T>;
}

export async function listScreeningCampaigns(): Promise<ScreeningCampaignSummary[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns`);
  const data = await parseJson<{ items: ScreeningCampaignSummary[] }>(res);
  return data.items ?? [];
}

export async function deleteScreeningCampaign(id: string): Promise<{ ok: boolean; id: string }> {
  const enc = encodeURIComponent(id);
  const base = `${API_BASE}/api/screening/campaigns/${enc}`;
  // POST …/delete works through most proxies; fallback to DELETE for older API builds.
  let res = await fetchWithAuth(`${base}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (res.status === 404 || res.status === 405) {
    res = await fetchWithAuth(base, { method: "DELETE" });
  }
  return parseJson(res);
}

export async function patchScreeningCampaign(
  id: string,
  body: { name: string }
): Promise<ScreeningCampaignSummary> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: body.name.trim() }),
  });
  return parseJson(res);
}

export async function createScreeningCampaign(
  body: CreateCampaignPayload
): Promise<{ campaignId: string; status: string }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function getScreeningCampaign(
  id: string
): Promise<ScreeningCampaignSummary> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${id}`);
  return parseJson(res);
}

export async function startScreeningCampaign(
  id: string
): Promise<{ ok: boolean; status: string; layer0?: Record<string, unknown> }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${id}/start`, {
    method: "POST",
    body: "{}",
  });
  return parseJson(res);
}

export async function startScreeningLayer1(
  id: string
): Promise<{ ok: boolean; status: string; layer1?: Record<string, unknown> }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${id}/layer1/start`, {
    method: "POST",
    body: "{}",
  });
  return parseJson(res);
}

export async function startScreeningLayer2(
  id: string
): Promise<{ ok: boolean; status: string; layer2?: Record<string, unknown> }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${id}/layer2/start`, {
    method: "POST",
    body: "{}",
  });
  return parseJson(res);
}

export async function startScreeningLayer3(
  id: string
): Promise<{ ok: boolean; status: string; layer3?: Record<string, unknown> }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns/${id}/layer3/start`, {
    method: "POST",
    body: "{}",
  });
  return parseJson(res);
}

export async function listCampaignCandidates(
  id: string,
  opts?: { limit?: number; offset?: number; selectedOnly?: boolean; includeEnrichment?: boolean }
): Promise<{ rows: ScreeningCampaignCandidate[]; total: number }> {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.selectedOnly) q.set("selectedOnly", "true");
  if (opts?.includeEnrichment) q.set("includeEnrichment", "true");
  const qs = q.toString();
  const url = `${API_BASE}/api/screening/campaigns/${id}/candidates${qs ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url);
  return parseJson(res);
}

export async function patchCandidateExclusion(
  campaignId: string,
  orgnr: string,
  body: { excludedFromAnalysis: boolean; exclusionReason?: string | null }
): Promise<{ ok: boolean }> {
  const enc = encodeURIComponent(orgnr);
  const res = await fetchWithAuth(
    `${API_BASE}/api/screening/campaigns/${campaignId}/candidates/${enc}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        excludedFromAnalysis: body.excludedFromAnalysis,
        exclusionReason: body.exclusionReason ?? null,
      }),
    }
  );
  return parseJson(res);
}
