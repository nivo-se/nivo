export const PROSPECT_STATUSES = [
  "new",
  "researching",
  "contacted",
  "in_discussion",
  "meeting_scheduled",
  "interested",
  "not_interested",
  "passed",
  "deal_in_progress",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export interface ProspectNote {
  id?: string;
  text: string;
  author: string;
  date: string;
}

export interface Prospect {
  id?: string;
  companyId: string;
  status: ProspectStatus;
  owner?: string;
  lastContact?: string;
  nextAction?: string;
  notes: ProspectNote[];
}

export interface ListProspectsParams {
  scope?: "team" | "private";
  status?: ProspectStatus;
}

export interface ProspectCreatePayload {
  company_id: string;
  status?: ProspectStatus;
  scope?: "team" | "private";
}

export interface ProspectUpdatePayload {
  status?: ProspectStatus;
  owner?: string;
  last_contact?: string;
  next_action?: string;
}

export interface ProspectNoteCreatePayload {
  text: string;
  author?: string;
}

export interface ProspectNoteUpdatePayload {
  text: string;
}
