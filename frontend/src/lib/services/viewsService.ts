import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export type SavedView = {
  id: string;
  name: string;
  owner_user_id: string;
  scope: "private" | "team";
  filtersJson: Record<string, unknown>;
  columnsJson: unknown[];
  sortJson: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getViews(scope: "private" | "team" | "all"): Promise<{ items: SavedView[] }> {
  const res = await fetchWithAuth(`${API_BASE}/api/views?scope=${scope}`);
  if (!res.ok) throw new Error("Failed to fetch views");
  return res.json();
}

export async function createView(payload: {
  name: string;
  scope?: "private" | "team";
  filtersJson?: Record<string, unknown>;
  columnsJson?: unknown[];
  sortJson?: Record<string, unknown>;
}): Promise<SavedView> {
  const res = await fetchWithAuth(`${API_BASE}/api/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create view");
  return res.json();
}

export async function updateView(
  id: string,
  payload: Partial<Pick<SavedView, "name" | "scope" | "filtersJson" | "columnsJson" | "sortJson">>
): Promise<SavedView> {
  const res = await fetchWithAuth(`${API_BASE}/api/views/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update view");
  return res.json();
}

export async function deleteView(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/views/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete view");
}
