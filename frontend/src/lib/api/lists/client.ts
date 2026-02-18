import { requestJson } from "@/lib/api/httpClient";

export type ListStage = "research" | "ai_analysis" | "prospects";

export interface SavedListRecord {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email?: string;
  scope: "private" | "team";
  source_view_id?: string | null;
  stage?: ListStage;
  created_at: string;
  updated_at: string;
}

export interface CreateFromQueryPayload {
  name: string;
  scope?: "private" | "team";
  queryPayload: {
    filters: { field: string; op: string; value: unknown; type: string }[];
    logic?: string;
    sort?: { by?: string; dir?: string };
    q?: string;
  };
}

export async function getListsClient(scope: "all" | "private" | "team" = "all") {
  return requestJson<{ items: SavedListRecord[] }>(`/api/lists?scope=${scope}`);
}

export async function createListClient(payload: {
  name: string;
  scope?: "private" | "team";
  sourceViewId?: string;
}) {
  return requestJson<SavedListRecord>(`/api/lists`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createListFromQueryClient(payload: CreateFromQueryPayload) {
  return requestJson<{ listId: string; insertedCount: number; totalMatched: number }>(
    "/api/lists/from_query",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getListItemsClient(listId: string) {
  return requestJson<{ list_id: string; items: Array<{ orgnr: string; added_by: string; added_at: string }> }>(
    `/api/lists/${listId}/items`
  );
}

export async function addListItemsClient(listId: string, orgnrs: string[]) {
  return requestJson<{ added: number }>(`/api/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ orgnrs }),
  });
}

export async function removeListItemClient(listId: string, orgnr: string) {
  return requestJson<{ removed: boolean }>(`/api/lists/${listId}/items/${encodeURIComponent(orgnr)}`, {
    method: "DELETE",
  });
}

export async function updateListClient(
  listId: string,
  payload: { name?: string; scope?: "private" | "team"; sourceViewId?: string | null; stage?: ListStage }
) {
  return requestJson<SavedListRecord>(`/api/lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteListClient(listId: string): Promise<{ deleted: boolean }> {
  return requestJson(`/api/lists/${listId}`, {
    method: "DELETE",
  });
}
