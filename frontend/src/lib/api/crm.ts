/**
 * CRM API (Node enhanced server, proxied `/crm` in dev).
 * Uses same-origin relative URLs when VITE_API_BASE_URL is unset.
 */
import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

function crmUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function parseError(json: Record<string, unknown>, status: number): string {
  const err = json?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") return JSON.stringify(err);
  return `HTTP ${status}`;
}

export async function crmFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(crmUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseError(json, res.status));
  }
  if (json.success === false) {
    throw new Error(parseError(json, res.status));
  }
  return json.data as T;
}

export interface CrmCompanyOverview {
  company: Record<string, unknown> | null;
  deal: Record<string, unknown>;
  contacts: Record<string, unknown>[];
  latest_outbound_email: Record<string, unknown> | null;
  activity_timeline: unknown[];
  next_action: { next_action_at: string | null; status: string };
  engagement_summary: {
    open_count: number;
    click_count: number;
    interaction_count?: number;
  };
}

export async function getCrmCompanyOverview(companyId: string): Promise<CrmCompanyOverview> {
  return crmFetchJson<CrmCompanyOverview>(`/crm/company/${encodeURIComponent(companyId)}`);
}

export interface CrmOutboundEmailRow {
  id: string;
  deal_id: string;
  contact_id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at?: string;
  crm_thread_id: string | null;
  tracking_id?: string;
  body_text?: string;
  contact_name: string | null;
  contact_email: string | null;
}

export async function getDealEmails(dealId: string): Promise<CrmOutboundEmailRow[]> {
  return crmFetchJson<CrmOutboundEmailRow[]>(`/crm/deals/${encodeURIComponent(dealId)}/emails`);
}

export async function patchDealNextAction(
  dealId: string,
  nextActionAt: string | null
): Promise<Record<string, unknown>> {
  return crmFetchJson<Record<string, unknown>>(`/crm/deals/${encodeURIComponent(dealId)}`, {
    method: "PATCH",
    body: JSON.stringify({ next_action_at: nextActionAt }),
  });
}

export async function createContact(payload: {
  company_id: string;
  email: string;
  full_name?: string;
  title?: string;
  is_primary?: boolean;
}): Promise<Record<string, unknown>> {
  return crmFetchJson<Record<string, unknown>>("/crm/contacts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateEmail(payload: {
  company_id: string;
  contact_id: string;
  user_instructions?: string;
  reason_for_interest?: string;
}): Promise<{ email_id: string; subject: string; body_text: string; body_html?: string }> {
  return crmFetchJson("/crm/emails/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createManualDraft(payload: {
  company_id: string;
  contact_id: string;
  subject: string;
  body_text: string;
  body_html?: string;
}): Promise<Record<string, unknown>> {
  return crmFetchJson("/crm/emails/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchDraftEmail(
  emailId: string,
  body: { subject?: string; body_text?: string; body_html?: string }
): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/emails/${encodeURIComponent(emailId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function approveEmail(
  emailId: string,
  body: { subject?: string; body_text?: string; body_html?: string }
): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/emails/${encodeURIComponent(emailId)}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendEmail(emailId: string): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/emails/${encodeURIComponent(emailId)}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface CrmThreadMessage {
  id: string;
  direction: string;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export async function getThreadMessages(threadId: string): Promise<CrmThreadMessage[]> {
  return crmFetchJson<CrmThreadMessage[]>(
    `/crm/email-threads/${encodeURIComponent(threadId)}/messages`
  );
}

export async function listCrmCompanies(search: string, limit = 50): Promise<
  {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    deal_status: string | null;
    last_contacted_at: string | null;
  }[]
> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", String(limit));
  return crmFetchJson(`/crm/companies?${params.toString()}`);
}
