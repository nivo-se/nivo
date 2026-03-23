import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";
import type { ExemplarChunksResponse, ExemplarMandateResponse } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Versioned screening mandate (patterns, archetypes, playbook). */
export async function getExemplarMandate(options?: {
  includeBody?: boolean;
}): Promise<ExemplarMandateResponse> {
  const q = options?.includeBody ? "?include_body=true" : "";
  const res = await fetchWithAuth(`${API_BASE}/api/screening/exemplar-mandate${q}`);
  return parseJson(res);
}

/** Indexed exemplar report chunks for an orgnr (requires migration + indexer). */
export async function getExemplarChunks(
  orgnr: string,
  limit = 80
): Promise<ExemplarChunksResponse> {
  const qs = new URLSearchParams({
    orgnr: orgnr.trim(),
    limit: String(Math.min(200, Math.max(1, limit))),
  });
  const res = await fetchWithAuth(`${API_BASE}/api/screening/exemplar-chunks?${qs}`);
  return parseJson(res);
}
