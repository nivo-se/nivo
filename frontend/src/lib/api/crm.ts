/**
 * CRM API — Node enhanced server (`frontend/server`, default port 3001), NOT FastAPI.
 *
 * Never use VITE_API_BASE_URL here: that points at FastAPI, which has no `/crm` routes and
 * returns 401 {"error":"unauthorized"} from JWT middleware when REQUIRE_AUTH=true.
 *
 * - `VITE_CRM_BASE_URL` unset: same-origin paths `/crm/...` (Vite dev proxies to 3001; prod
 *   must route `/crm` to the enhanced server or set this env to the server’s public URL).
 * - `VITE_CRM_BASE_URL` set: absolute base, e.g. https://crm-api.example.com
 */
import { fetchWithAuth } from "@/lib/backendFetch";

const CRM_BASE = (import.meta.env.VITE_CRM_BASE_URL ?? "").trim();

function crmUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!CRM_BASE) return p;
  return `${CRM_BASE.replace(/\/$/, "")}${p}`;
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

export async function updateDealStatus(
  dealId: string,
  payload: { status: string; summary?: string }
): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/deals/${encodeURIComponent(dealId)}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addDealNote(
  dealId: string,
  payload: { summary: string; metadata?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/deals/${encodeURIComponent(dealId)}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export async function patchContact(
  contactId: string,
  payload: {
    full_name?: string;
    title?: string;
    email?: string;
  }
): Promise<Record<string, unknown>> {
  return crmFetchJson<Record<string, unknown>>(`/crm/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
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

export async function sendEmail(
  emailId: string,
  options?: { send_provider?: "auto" | "resend" | "gmail" }
): Promise<Record<string, unknown>> {
  return crmFetchJson(`/crm/emails/${encodeURIComponent(emailId)}/send`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
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

export async function listCrmCompanies(
  search: string,
  limit = 50,
  opts?: { sort?: "name" | "last_contact" }
): Promise<
  {
    id: string;
    orgnr?: string | null;
    name: string;
    industry: string | null;
    website: string | null;
    deal_status: string | null;
    last_contacted_at: string | null;
    correspondence_total: number;
    correspondence_inbound: number;
    correspondence_outbound: number;
  }[]
> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", String(limit));
  if (opts?.sort) params.set("sort", opts.sort);
  return crmFetchJson(`/crm/companies?${params.toString()}`);
}

export interface CrmEmailConfig {
  resend_configured: boolean;
  missing: string[];
  /** True when Reply-To host was taken from the From address (RESEND_REPLY_DOMAIN not set). */
  reply_domain_inferred?: boolean;
  /** When true, the server can run Google OAuth for per-user Gmail send. */
  gmail_oauth_server_configured: boolean;
  /** Env vars missing to enable Gmail OAuth (see docs). */
  gmail_oauth_missing: string[];
}

export async function getCrmEmailConfig(): Promise<CrmEmailConfig> {
  return crmFetchJson<CrmEmailConfig>("/crm/email-config");
}

export interface CrmGoogleWorkspaceFlags {
  gmail_send: boolean;
  /** When true, CRM can import inbox replies via Gmail API (reconnect after this scope ships). */
  gmail_readonly: boolean;
  drive_file: boolean;
  calendar_events: boolean;
}

export interface CrmGmailStatus {
  server_configured: boolean;
  connected: boolean;
  google_email: string | null;
  /** From Google profile at connect; used as outbound From display name. */
  google_display_name: string | null;
  workspace: CrmGoogleWorkspaceFlags;
}

export async function getCrmGmailStatus(): Promise<CrmGmailStatus> {
  return crmFetchJson<CrmGmailStatus>("/crm/gmail/status");
}

export interface GmailInboundSyncResult {
  mailboxes_scanned: number;
  messages_fetched: number;
  imported: number;
  skipped_not_crm: number;
  skipped_duplicate: number;
  errors: string[];
}

/** Pull Gmail inbox replies into CRM for the current user’s connected account (CRM-matched senders only). */
export async function syncCrmGmailInbound(): Promise<GmailInboundSyncResult> {
  return crmFetchJson<GmailInboundSyncResult>("/crm/gmail/sync-inbound", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getCrmGmailOAuthUrl(): Promise<string> {
  const data = await crmFetchJson<{ url: string }>("/crm/gmail/oauth/url", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data.url;
}

export async function disconnectCrmGmail(): Promise<void> {
  await crmFetchJson("/crm/gmail/oauth", { method: "DELETE", body: JSON.stringify({}) });
}

export interface CrmInboundRecentRow {
  id: string;
  thread_id: string;
  subject: string | null;
  text_body: string | null;
  received_at: string | null;
  created_at: string;
  company_id: string;
  company_name: string | null;
  deal_id: string;
  contact_id: string;
  contact_email: string | null;
}

export async function getRecentInbound(limit = 50): Promise<CrmInboundRecentRow[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return crmFetchJson<CrmInboundRecentRow[]>(`/crm/inbound/recent?${params}`);
}

export interface CrmRecentSentRow {
  id: string;
  deal_id: string;
  contact_id: string | null;
  company_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  tracking_id: string | null;
}

export async function getRecentSent(limit = 20): Promise<CrmRecentSentRow[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return crmFetchJson<CrmRecentSentRow[]>(`/crm/recent-sent?${params}`);
}

export interface CrmInboundUnmatchedRow {
  id: string;
  token_attempted: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  provider_inbound_email_id: string | null;
  created_at: string;
}

export async function getUnmatchedInbound(limit = 50): Promise<CrmInboundUnmatchedRow[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return crmFetchJson<CrmInboundUnmatchedRow[]>(`/crm/inbound/unmatched?${params}`);
}

export interface CrmBatchDraftRow {
  email_id: string;
  company_id: string;
  contact_id: string;
  orgnr: string;
  subject: string;
  company_name?: string;
}

export async function generateBatchEmails(payload: {
  list_id: string;
  user_instructions?: string;
  reason_for_interest?: string;
}): Promise<{
  drafts: CrmBatchDraftRow[];
  skipped: { orgnr?: string; company_id?: string; reason: string }[];
}> {
  return crmFetchJson("/crm/emails/generate-batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createExternalCompany(payload: {
  name: string;
  orgnr?: string;
  website?: string;
}): Promise<Record<string, unknown>> {
  return crmFetchJson<Record<string, unknown>>("/crm/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchCrmCompany(
  companyId: string,
  payload: { industry?: string | null; website?: string | null }
): Promise<Record<string, unknown>> {
  return crmFetchJson<Record<string, unknown>>(`/crm/companies/${encodeURIComponent(companyId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function ensureDealFromCompany(companyId: string): Promise<Record<string, unknown>> {
  return crmFetchJson("/crm/deals/from-company", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId }),
  });
}

export interface QuickSendInput {
  to_email: string;
  recipient_name?: string;
  /** Either company_id or company_name is required. */
  company_id?: string;
  company_name?: string;
  orgnr?: string;
  website?: string;
  subject: string;
  body_text: string;
  body_html?: string;
}

export interface QuickSendResult {
  email_id: string;
  deal_id: string;
  company_id: string;
  contact_id: string;
  status: string;
  sent_at: string | null;
}

/** Single-call paste-and-send: creates company/contact/deal as needed, drafts, approves, and sends. */
export async function quickSend(payload: QuickSendInput): Promise<QuickSendResult> {
  return crmFetchJson<QuickSendResult>("/crm/quick-send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
