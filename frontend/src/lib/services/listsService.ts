import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export type SavedList = {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email?: string;
  scope: "private" | "team";
  source_view_id?: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
};

function throwApiError(msg: string, res: Response): never {
  const err = new Error(msg || "Request failed") as Error & { status?: number };
  err.status = res.status;
  throw err;
}

export async function getLists(scope: "private" | "team" | "all"): Promise<{ items: SavedList[] }> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists?scope=${scope}`);
  if (!res.ok) throwApiError(await res.text() || "Failed to fetch lists", res);
  return res.json();
}

export async function createList(payload: {
  name: string;
  scope?: "private" | "team";
  sourceViewId?: string;
}): Promise<SavedList> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwApiError(await res.text() || "Failed to create list", res);
  return res.json();
}

export type CreateFromQueryPayload = {
  name: string;
  scope?: "private" | "team";
  queryPayload: {
    filters: { field: string; op: string; value: unknown; type: string }[];
    logic?: string;
    sort?: { by?: string; dir?: string };
    q?: string;
  };
};

export type CreateFromQueryResponse = {
  listId: string;
  insertedCount: number;
  totalMatched: number;
};

export async function createListFromQuery(
  payload: CreateFromQueryPayload
): Promise<CreateFromQueryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists/from_query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwApiError(await res.text() || "Failed to create list from query", res);
  return res.json();
}

export async function addListItems(listId: string, orgnrs: string[]): Promise<{ added: number }> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgnrs }),
  });
  if (!res.ok) throwApiError(await res.text() || "Failed to add items", res);
  return res.json();
}

export async function removeListItem(listId: string, orgnr: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists/${listId}/items/${encodeURIComponent(orgnr)}`, {
    method: "DELETE",
  });
  if (!res.ok) throwApiError(await res.text() || "Failed to remove item", res);
}

export async function getListItems(listId: string): Promise<{
  list_id: string;
  items: { orgnr: string; added_by: string; added_at: string }[];
}> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists/${listId}/items`);
  if (!res.ok) throwApiError(await res.text() || "Failed to fetch list items", res);
  return res.json();
}

export async function deleteList(listId: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/lists/${listId}`, { method: "DELETE" });
  if (!res.ok) throwApiError(await res.text() || "Failed to delete list", res);
}
