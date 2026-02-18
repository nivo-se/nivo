import {
  addProspectNoteClient,
  deleteProspectNoteClient,
  getProspectClient,
  getProspectsClient,
  updateProspectClient,
  updateProspectNoteClient,
  upsertProspectClient,
} from "@/lib/api/prospects/client";
import type {
  ListProspectsParams,
  Prospect,
  ProspectStatus,
} from "@/lib/api/prospects/types";

export async function getProspects(params: ListProspectsParams = {}): Promise<Prospect[]> {
  const res = await getProspectsClient(params);
  return res.items ?? [];
}

export async function getProspect(companyId: string): Promise<Prospect | null> {
  return getProspectClient(companyId);
}

export async function upsertProspect(companyId: string, status: ProspectStatus = "new"): Promise<Prospect> {
  return upsertProspectClient({
    company_id: companyId,
    status,
    scope: "team",
  });
}

export async function updateProspectStatus(companyId: string, status: ProspectStatus): Promise<Prospect> {
  return updateProspectClient(companyId, { status });
}

export async function addProspectNote(companyId: string, note: { text: string; author?: string }): Promise<Prospect> {
  await addProspectNoteClient(companyId, note);
  const refreshed = await getProspect(companyId);
  if (!refreshed) throw new Error("Prospect not found after note add");
  return refreshed;
}

export async function updateProspectNote(
  companyId: string,
  noteIndex: number,
  text: string
): Promise<Prospect> {
  const current = await getProspect(companyId);
  const noteId = current?.notes?.[noteIndex]?.id;
  if (!noteId) throw new Error("Prospect note id missing");
  await updateProspectNoteClient(companyId, noteId, { text });
  const refreshed = await getProspect(companyId);
  if (!refreshed) throw new Error("Prospect not found after note update");
  return refreshed;
}

export async function deleteProspectNote(companyId: string, noteIndex: number): Promise<void> {
  const current = await getProspect(companyId);
  const noteId = current?.notes?.[noteIndex]?.id;
  if (!noteId) throw new Error("Prospect note id missing");
  await deleteProspectNoteClient(companyId, noteId);
}
