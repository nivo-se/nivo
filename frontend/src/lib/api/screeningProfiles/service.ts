import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";
import type { ScreeningContext, ScreeningProfileSummary } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function getScreeningContext(): Promise<ScreeningContext> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/context`);
  return parseJson(res);
}

export async function listScreeningProfiles(
  scope: "all" | "private" | "team" = "all"
): Promise<ScreeningProfileSummary[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles?scope=${scope}`);
  const data = await parseJson<{ items: ScreeningProfileSummary[] }>(res);
  return data.items ?? [];
}

export async function getScreeningProfile(id: string): Promise<ScreeningProfileSummary> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles/${id}`);
  return parseJson(res);
}

export async function createScreeningProfile(body: {
  name: string;
  description?: string;
  scope: "private" | "team";
}): Promise<ScreeningProfileSummary> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateScreeningProfile(
  id: string,
  body: { name?: string; description?: string | null; scope?: "private" | "team" }
): Promise<ScreeningProfileSummary> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function createProfileVersion(
  profileId: string,
  config: Record<string, unknown>
): Promise<{ id: string; version: number; isActive?: boolean }> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles/${profileId}/versions`, {
    method: "POST",
    body: JSON.stringify({ config }),
  });
  return parseJson(res);
}

export async function activateProfileVersion(
  profileId: string,
  versionId: string
): Promise<{ id: string; version: number; isActive?: boolean }> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/screening/profiles/${profileId}/versions/${versionId}/activate`,
    { method: "PUT" }
  );
  return parseJson(res);
}

export async function deleteScreeningProfile(profileId: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/screening/profiles/${profileId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}
