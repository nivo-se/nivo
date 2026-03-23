import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";
import type {
  CreateCampaignPayload,
  ScreeningCampaignCandidate,
  ScreeningCampaignSummary,
} from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function listScreeningCampaigns(): Promise<ScreeningCampaignSummary[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/campaigns`);
  const data = await parseJson<{ items: ScreeningCampaignSummary[] }>(res);
  return data.items ?? [];
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

export async function listCampaignCandidates(
  id: string,
  opts?: { limit?: number; offset?: number; selectedOnly?: boolean }
): Promise<{ rows: ScreeningCampaignCandidate[]; total: number }> {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.selectedOnly) q.set("selectedOnly", "true");
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
