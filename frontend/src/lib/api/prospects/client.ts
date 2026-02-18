import { requestJson } from "@/lib/api/httpClient";
import type {
  ListProspectsParams,
  Prospect,
  ProspectCreatePayload,
  ProspectNote,
  ProspectNoteCreatePayload,
  ProspectNoteUpdatePayload,
  ProspectUpdatePayload,
} from "@/lib/api/prospects/types";

export async function getProspectsClient(params: ListProspectsParams = {}): Promise<{ items: Prospect[]; count?: number; total?: number }> {
  const qs = new URLSearchParams();
  qs.set("scope", params.scope ?? "team");
  if (params.status) qs.set("status", params.status);
  return requestJson(`/api/prospects?${qs.toString()}`);
}

export async function getProspectClient(companyId: string, scope: "team" | "private" = "team"): Promise<Prospect | null> {
  const res = await getProspectsClient({ scope });
  return res.items.find((p) => p.companyId === companyId || p.id === companyId) ?? null;
}

export async function upsertProspectClient(payload: ProspectCreatePayload): Promise<Prospect> {
  return requestJson("/api/prospects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProspectClient(companyId: string, patch: ProspectUpdatePayload): Promise<Prospect> {
  return requestJson(`/api/prospects/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function addProspectNoteClient(companyId: string, note: ProspectNoteCreatePayload): Promise<ProspectNote> {
  return requestJson(`/api/prospects/${companyId}/notes`, {
    method: "POST",
    body: JSON.stringify(note),
  });
}

export async function updateProspectNoteClient(
  companyId: string,
  noteId: string,
  payload: ProspectNoteUpdatePayload
): Promise<ProspectNote> {
  return requestJson(`/api/prospects/${companyId}/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProspectNoteClient(companyId: string, noteId: string): Promise<{ success: boolean }> {
  return requestJson(`/api/prospects/${companyId}/notes/${noteId}`, {
    method: "DELETE",
  });
}

export async function deleteProspectClient(_companyId: string): Promise<void> {
  throw new Error("DELETE /api/prospects/{company_id} is not available on the backend yet");
}
