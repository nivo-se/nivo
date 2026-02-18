/**
 * Figma API adapter - maps nivo-figma-app expected API interface to Nivo backend.
 * Use when migrating Figma export pages into the main Nivo frontend.
 *
 * Uses fetchWithAuth for authenticated requests and VITE_API_BASE_URL.
 * Mapping doc: docs/FIGMA_MIGRATION.md
 */
import { fetchWithAuth } from "@/lib/backendFetch";
import {
  queryUniverse,
  getUniverseFilters,
  type UniverseRow,
  type UniverseQueryPayload,
} from "@/lib/services/universeQueryService";
import {
  getLists as nivoGetLists,
  createList as nivoCreateList,
  createListFromQuery,
  addListItems,
  getListItems,
  removeListItem,
  deleteList as nivoDeleteList,
  type SavedList,
  type CreateFromQueryPayload,
} from "@/lib/services/listsService";
import {
  guardUniverseQueryResponse,
  guardListsResponse,
  guardListItemsResponse,
  guardAnalysisRunsResponse,
  guardAnalysisRunResponse,
  guardAnalysisRunCompaniesResponse,
  guardCompaniesBatchResponse,
} from "@/lib/services/figmaApiGuards";
import { API_BASE } from "@/lib/apiClient";
import { DEFAULT_PROMPT_TEMPLATES } from "@/lib/defaultPromptTemplates";

import type {
  Company,
  List,
  ProspectStatus,
  PromptTemplate,
  AIRun,
  AIResult,
  AIProfile,
  CreateListDTO,
  CreateAIRunDTO,
} from "@/types/figma";

/** Single API error for Admin Contracts. */
export interface LastApiError {
  message: string;
  endpoint: string;
  status?: number;
  timestamp: string;
}

const MAX_API_ERRORS = 5;
let apiErrors: LastApiError[] = [];

export function getLastApiError(): LastApiError | null {
  return apiErrors[0] ?? null;
}

export function getLastApiErrors(): LastApiError[] {
  return [...apiErrors];
}

export function setLastApiError(
  msg: string | null,
  endpoint?: string,
  status?: number
): void {
  if (!msg) return;
  const entry: LastApiError = {
    message: msg,
    endpoint: endpoint ?? "unknown",
    status,
    timestamp: new Date().toISOString(),
  };
  apiErrors = [entry, ...apiErrors].slice(0, MAX_API_ERRORS);
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetchWithAuth(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const msg = await res.text();
    setLastApiError(msg || `API error: ${res.status}`, endpoint, res.status);
    throw new Error(msg || `API error: ${res.status}`);
  }
  return res.json();
}

// ---- Companies ----

function toNull<T>(v: T | null | undefined): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  return v;
}

function mapUniverseRowToCompany(row: UniverseRow): Company {
  const aiFit = row.ai_strategic_fit_score;
  const aiBadge =
    aiFit != null
      ? aiFit >= 7
        ? "Strong"
        : aiFit >= 5
          ? "Neutral"
          : aiFit >= 1
            ? "Weak"
            : null
      : null;
  const segmentNames = row.segment_names ?? [];
  return {
    orgnr: String(row.orgnr ?? ""),
    display_name: row.name ?? row.orgnr ?? "",
    legal_name: row.name ?? row.orgnr ?? "",
    industry_label: Array.isArray(segmentNames) ? segmentNames[0] ?? "Unknown" : "Unknown",
    segment_names: Array.isArray(segmentNames) ? segmentNames : null,
    has_homepage: Boolean(row.has_homepage),
    has_ai_profile: Boolean(row.has_ai_profile),
    has_3y_financials: Boolean(row.has_3y_financials),
    data_quality_score: toNull(row.data_quality_score),
    is_stale: Boolean(row.is_stale),
    last_enriched_at: row.last_enriched_at ?? undefined,
    revenue_latest: toNull(row.revenue_latest),
    ebitda_margin_latest: toNull(row.ebitda_margin_latest),
    revenue_cagr_3y: toNull(row.revenue_cagr_3y),
    employees_latest: toNull(row.employees_latest),
    region: row.municipality ? String(row.municipality) : undefined,
    website_url: row.homepage ? String(row.homepage) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    ai_profile: row.has_ai_profile
      ? { ai_fit_score: aiFit ?? undefined, ai_badge: aiBadge ?? undefined }
      : undefined,
    equity_ratio_latest: toNull(row.equity_ratio_latest),
    debt_to_equity_latest: toNull(row.debt_to_equity_latest),
    currency: "SEK",
    years_available: 0,
    latest_year: new Date().getFullYear(),
    status: "active",
    financials: [],
  };
}

/** Get companies (paginated via Universe query). Pass signal to abort. */
export async function getCompanies(
  payload?: Partial<UniverseQueryPayload>,
  signal?: AbortSignal
): Promise<Company[]> {
  const { companies } = await getCompaniesWithTotal(payload, signal);
  return companies;
}

/** Get companies with total count from Universe query. */
export async function getCompaniesWithTotal(
  payload?: Partial<UniverseQueryPayload>,
  signal?: AbortSignal
): Promise<{ companies: Company[]; total: number }> {
  try {
    const result = await queryUniverse(
      {
        filters: payload?.filters ?? [],
        logic: "and",
        sort: payload?.sort ?? { by: "data_quality_score", dir: "asc" },
        limit: payload?.limit ?? 500,
        offset: payload?.offset ?? 0,
        q: payload?.q,
      },
      signal
    );
    guardUniverseQueryResponse(result);
    setLastApiError(null);
    return {
      companies: result.rows.map((r) => mapUniverseRowToCompany(r as UniverseRow)),
      total: result.total,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setLastApiError(msg, "POST /api/universe/query");
    throw e;
  }
}

/** Get single company by orgnr. Uses Universe query search (q param). */
export async function getCompany(orgnr: string, signal?: AbortSignal): Promise<Company | null> {
  try {
    const result = await queryUniverse(
      { q: orgnr.trim(), limit: 1, sort: { by: "orgnr", dir: "asc" } },
      signal
    );
    guardUniverseQueryResponse(result);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as UniverseRow;
    if (row.orgnr !== orgnr) return null;
    return mapUniverseRowToCompany(row);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "POST /api/universe/query");
    return null;
  }
}

/** Search companies by query string. */
export async function searchCompanies(query: string, limit = 50, signal?: AbortSignal): Promise<Company[]> {
  if (!query.trim()) return [];
  const result = await queryUniverse(
    { q: query.trim(), limit, sort: { by: "data_quality_score", dir: "asc" } },
    signal
  );
  guardUniverseQueryResponse(result);
  return result.rows.map((r) => mapUniverseRowToCompany(r as UniverseRow));
}

// ---- Lists ----

function mapSavedListToFigmaList(saved: SavedList, companyIds: string[]): List {
  return {
    id: saved.id,
    name: saved.name,
    owner_user_id: saved.owner_user_id,
    scope: saved.scope,
    source_view_id: saved.source_view_id,
    companyIds,
    stage: "research",
    created_at: saved.created_at,
    updated_at: saved.updated_at,
    created_by: saved.owner_user_id,
    created_by_name: saved.owner_email,
    updated_by: saved.owner_user_id,
  };
}

export async function getLists(): Promise<List[]> {
  let raw: Awaited<ReturnType<typeof nivoGetLists>>;
  try {
    raw = await nivoGetLists("all");
    guardListsResponse(raw);
    setLastApiError(null);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/lists");
    throw e;
  }
  const { items } = raw;
  const lists: List[] = [];
  for (const saved of items) {
    try {
      const itemsRes = await getListItems(saved.id);
      guardListItemsResponse(itemsRes);
      const companyIds = itemsRes.items.map((i: { orgnr: string }) => i.orgnr);
      lists.push(mapSavedListToFigmaList(saved, companyIds));
    } catch {
      lists.push(mapSavedListToFigmaList(saved, []));
    }
  }
  return lists;
}

export async function getList(listId: string): Promise<List | null> {
  const raw = await nivoGetLists("all");
  guardListsResponse(raw);
  const saved = raw.items.find((l: { id: string }) => l.id === listId);
  if (!saved) return null;
  try {
    const itemsRes = await getListItems(listId);
    guardListItemsResponse(itemsRes);
    const companyIds = itemsRes.items.map((i: { orgnr: string }) => i.orgnr);
    return mapSavedListToFigmaList(saved as SavedList, companyIds);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/lists/:id/items");
    return mapSavedListToFigmaList(saved as SavedList, []);
  }
}

export async function createList(data: CreateListDTO): Promise<List> {
  if (data.companyIds?.length && data.companyIds.length > 0) {
    const saved = await nivoCreateList({
      name: data.name,
      scope: data.scope ?? "private",
    });
    await addListItems(saved.id, data.companyIds);
    const list = await getList(saved.id);
    return list!;
  }
  const saved = await nivoCreateList({
    name: data.name,
    scope: data.scope ?? "private",
  });
  return mapSavedListToFigmaList(saved, []);
}

/** Create list from Universe query (recommended when creating from filtered Universe). */
export async function createListFromUniverseQuery(
  payload: CreateFromQueryPayload
): Promise<{ listId: string; insertedCount: number; totalMatched: number }> {
  try {
    const res = await createListFromQuery(payload);
    setLastApiError(null);
    return res;
  } catch (e) {
    const err = e as Error & { status?: number };
    setLastApiError(err.message, "POST /api/lists/from_query", err.status);
    throw e;
  }
}

export async function updateList(listId: string, data: Partial<List>): Promise<List> {
  const res = await apiFetch<{
    id: string;
    name: string;
    owner_user_id: string;
    scope: "private" | "team";
    source_view_id?: string | null;
    created_at: string;
    updated_at: string;
  }>(`/api/lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      scope: data.scope,
    }),
  });
  const existing = await getList(listId);
  return {
    id: res.id,
    name: res.name,
    owner_user_id: res.owner_user_id,
    scope: res.scope,
    source_view_id: res.source_view_id ?? undefined,
    companyIds: existing?.companyIds ?? [],
    stage: existing?.stage ?? "research",
    created_at: res.created_at,
    updated_at: res.updated_at,
    created_by: res.owner_user_id,
    created_by_name: existing?.created_by_name,
    updated_by: res.owner_user_id,
  };
}

export async function deleteList(listId: string): Promise<void> {
  await nivoDeleteList(listId);
}

/** Add companies to an existing list. */
export async function addToList(listId: string, orgnrs: string[]): Promise<{ added: number }> {
  try {
    const res = await addListItems(listId, orgnrs);
    setLastApiError(null);
    return res;
  } catch (e) {
    const err = e as Error & { status?: number };
    setLastApiError(err.message, `POST /api/lists/${listId}/items`, err.status);
    throw e;
  }
}

/** Remove a company from a list. */
export async function removeFromList(listId: string, orgnr: string): Promise<void> {
  try {
    await removeListItem(listId, orgnr);
    setLastApiError(null);
  } catch (e) {
    const err = e as Error & { status?: number };
    setLastApiError(err.message, `DELETE /api/lists/${listId}/items/:orgnr`, err.status);
    throw e;
  }
}

/** Get company details for multiple orgnrs via /api/companies/batch. Maps to Company[]. */
export async function getCompaniesBatch(
  orgnrs: string[],
  options?: { autoEnrich?: boolean }
): Promise<Company[]> {
  if (orgnrs.length === 0) return [];
  const params = new URLSearchParams();
  if (options?.autoEnrich === false) params.set("auto_enrich", "false");
  const query = params.toString();
  const url = `/api/companies/batch${query ? `?${query}` : ""}`;
  try {
    const res = await apiFetch<unknown>(url, {
      method: "POST",
      body: JSON.stringify({ orgnrs }),
    });
    guardCompaniesBatchResponse(res);
    const r = res as { companies: Array<Record<string, unknown>>; count: number };
    setLastApiError(null);
    return r.companies.map((row) => mapBatchRowToCompany(row));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setLastApiError(msg, "POST /api/companies/batch");
    throw e;
  }
}

function mapBatchRowToCompany(row: Record<string, unknown>): Company {
  const rev = row.latest_revenue_sek;
  const margin = row.avg_ebitda_margin;
  const seg = row.segment_names;
  const segArr = Array.isArray(seg) ? seg : seg ? [String(seg)] : [];
  const homepage = row.homepage ? String(row.homepage) : undefined;
  const email = row.email ? String(row.email) : undefined;
  const phone = row.phone ? String(row.phone) : undefined;
  return {
    orgnr: String(row.orgnr ?? ""),
    display_name: String(row.company_name ?? row.orgnr ?? ""),
    legal_name: String(row.company_name ?? row.orgnr ?? ""),
    industry_label: segArr[0] ? String(segArr[0]) : "Unknown",
    region: row.region ? String(row.region) : undefined,
    website_url: homepage,
    email,
    phone,
    revenue_latest: toNull(typeof rev === "number" ? rev : null),
    ebitda_margin_latest: toNull(typeof margin === "number" ? margin : null),
    revenue_cagr_3y: toNull(row.revenue_cagr_3y as number | null),
    employees_latest: toNull(row.employees_latest as number | null),
    equity_ratio_latest: toNull(row.equity_ratio_latest as number | null),
    debt_to_equity_latest: toNull(row.debt_to_equity_latest as number | null),
    leverage_ratio: typeof row.debt_to_equity_latest === "number" ? row.debt_to_equity_latest : undefined,
    data_quality_score: null,
    has_homepage: Boolean(row.homepage),
    has_ai_profile: Boolean(row.ai_strategic_score != null),
    has_3y_financials: true,
    is_stale: false,
    currency: "SEK",
    years_available: 0,
    latest_year: new Date().getFullYear(),
    status: "active",
    financials: [],
  };
}

// ---- Prospects ----

type ProspectNoteApi = { id?: string; text: string; author?: string; date?: string };
type ProspectApi = {
  id?: string;
  companyId?: string;
  company_id?: string;
  status?: ProspectStatus["status"];
  owner?: string;
  lastContact?: string;
  last_contact?: string;
  nextAction?: string;
  next_action?: string;
  notes?: ProspectNoteApi[];
};

function mapProspectApiToStatus(row: ProspectApi): ProspectStatus {
  return {
    id: row.id,
    companyId: String(row.companyId ?? row.company_id ?? ""),
    status: (row.status ?? "new") as ProspectStatus["status"],
    owner: row.owner,
    lastContact: row.lastContact ?? row.last_contact,
    nextAction: row.nextAction ?? row.next_action,
    notes: (row.notes ?? []).map((n) => ({
      id: n.id,
      text: n.text,
      author: n.author ?? "",
      date: n.date ?? new Date().toISOString(),
    })),
  };
}

export async function getProspects(): Promise<ProspectStatus[]> {
  const res = await apiFetch<{ items?: ProspectApi[] }>("/api/prospects?scope=team");
  return (res.items ?? []).map(mapProspectApiToStatus);
}

export async function getProspect(prospectId: string): Promise<ProspectStatus | null> {
  const items = await getProspects();
  return items.find((p) => p.companyId === prospectId || p.id === prospectId) ?? null;
}

export async function createProspect(companyId: string): Promise<ProspectStatus> {
  const row = await apiFetch<ProspectApi>("/api/prospects", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, status: "new", scope: "team" }),
  });
  return mapProspectApiToStatus(row);
}

export async function updateProspectStatus(
  prospectId: string,
  updates: Partial<ProspectStatus>
): Promise<ProspectStatus> {
  const row = await apiFetch<ProspectApi>(`/api/prospects/${prospectId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: updates.status,
      owner: updates.owner,
      last_contact: updates.lastContact,
      next_action: updates.nextAction,
    }),
  });
  return mapProspectApiToStatus(row);
}

export async function addProspectNote(
  prospectId: string,
  note: { text: string; author: string }
): Promise<ProspectStatus> {
  await apiFetch(`/api/prospects/${prospectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ text: note.text, author: note.author }),
  });
  const refreshed = await getProspect(prospectId);
  if (!refreshed) throw new Error("Prospect not found after note add");
  return refreshed;
}

export async function updateProspectNote(
  prospectId: string,
  noteIndex: number,
  text: string
): Promise<ProspectStatus> {
  const current = await getProspect(prospectId);
  const note = current?.notes?.[noteIndex];
  if (!note || !current?.id) throw new Error("Prospect note not found");
  const noteId = (current as unknown as { notes?: Array<{ id?: string }> }).notes?.[noteIndex]?.id;
  if (!noteId) throw new Error("Prospect note id missing");
  await apiFetch(`/api/prospects/${prospectId}/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
  const refreshed = await getProspect(prospectId);
  if (!refreshed) throw new Error("Prospect not found after note update");
  return refreshed;
}

export async function deleteProspectNote(prospectId: string, noteIndex: number): Promise<void> {
  const current = await getProspect(prospectId);
  const noteId = (current as unknown as { notes?: Array<{ id?: string }> }).notes?.[noteIndex]?.id;
  if (!noteId) throw new Error("Prospect note id missing");
  await apiFetch(`/api/prospects/${prospectId}/notes/${noteId}`, { method: "DELETE" });
}

// ---- AI Templates ----

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  try {
    const res = await apiFetch<{ items?: Array<Record<string, unknown>> }>("/api/analysis/templates");
    const items = (res.items ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      prompt: String(row.prompt ?? ""),
      variables: Array.isArray(row.variables) ? row.variables.map(String) : [],
      scoringDimensions: Array.isArray(row.scoringDimensions)
        ? (row.scoringDimensions as PromptTemplate["scoringDimensions"])
        : [],
      created_at: String(row.created_at ?? new Date().toISOString()),
      created_by: String(row.created_by ?? "system"),
    }));
    if (items.length > 0) return items;
  } catch {
    // fallback to defaults
  }
  return [...DEFAULT_PROMPT_TEMPLATES];
}

export async function getPromptTemplate(templateId: string): Promise<PromptTemplate | null> {
  const found = DEFAULT_PROMPT_TEMPLATES.find((t) => t.id === templateId);
  return found ?? null;
}

export async function createPromptTemplate(
  data: Omit<PromptTemplate, "id" | "created_at" | "created_by">
): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>("/api/analysis/templates", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      variables: data.variables,
      scoring_dimensions: data.scoringDimensions,
    }),
  });
}

export async function updatePromptTemplate(
  templateId: string,
  data: Partial<PromptTemplate>
): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>(`/api/analysis/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      variables: data.variables,
      scoring_dimensions: data.scoringDimensions,
    }),
  });
}

export async function duplicatePromptTemplate(templateId: string): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>(`/api/analysis/templates/${templateId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ---- AI Runs (mapped to Nivo /api/analysis) ----

type AnalysisRunApi = {
  run_id: string;
  status: string;
  stage: number;
  stage1_count?: number;
  stage2_count?: number;
  stage3_count?: number;
  started_at: string;
  completed_at?: string;
  name?: string;
  list_id?: string;
  template_id?: string;
  template_name?: string;
  config?: { auto_approve?: boolean; overwrite_existing?: boolean };
};

function mapAnalysisRunToAIRun(r: AnalysisRunApi): AIRun {
  const total = r.stage1_count ?? r.stage2_count ?? r.stage3_count ?? 0;
  const processed = r.stage3_count ?? 0;
  const statusMap: Record<string, AIRun["status"]> = {
    running: "running",
    stage_1_complete: "running",
    stage_2_complete: "running",
    complete: "completed",
    completed: "completed",
    failed: "failed",
    queued: "queued",
  };
  const cfg = r.config ?? {};
  const perCompanyEstimate = 0.02;
  return {
    id: r.run_id,
    name: r.name?.trim() || `Run ${r.run_id.slice(0, 8)}`,
    list_id: r.list_id ?? "",
    template_id: r.template_id ?? "",
    status: statusMap[r.status] ?? "queued",
    created_at: r.started_at,
    created_by: "system",
    started_at: r.started_at,
    completed_at: r.completed_at,
    total_companies: total,
    processed_companies: processed,
    failed_companies: 0,
    estimated_cost: total * perCompanyEstimate,
    actual_cost: (r.status === "complete" || r.status === "completed") ? processed * perCompanyEstimate : 0,
    config: {
      auto_approve: cfg.auto_approve === true,
      overwrite_existing: cfg.overwrite_existing === true,
    },
  };
}

export async function getAIRuns(): Promise<AIRun[]> {
  try {
    const res = await apiFetch<unknown>("/api/analysis/runs?limit=50");
    guardAnalysisRunsResponse(res);
    const r = res as { success: boolean; runs?: AnalysisRunApi[] };
    setLastApiError(null);
    if (!r.runs) return [];
    return r.runs.map(mapAnalysisRunToAIRun);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/analysis/runs");
    throw e;
  }
}

export async function getAIRun(runId: string): Promise<AIRun | null> {
  try {
    const r = await apiFetch<AnalysisRunApi>(`/api/analysis/runs/${runId}`);
    guardAnalysisRunResponse(r);
    setLastApiError(null);
    return mapAnalysisRunToAIRun(r);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/analysis/runs/:id");
    return null;
  }
}

export async function createAIRun(data: CreateAIRunDTO): Promise<AIRun> {
  const template = DEFAULT_PROMPT_TEMPLATES.find((t) => t.id === data.template_id);
  const body: Record<string, unknown> = {
    name: data.name,
    template_id: data.template_id,
    template_name: template?.name ?? data.template_id,
    template_prompt: template?.prompt ?? "",
    config: data.config,
    run_async: true,
    min_revenue: 0,
    min_ebitda_margin: -1,
    min_growth: -1,
    max_results: 500,
  };
  if (data.orgnrs && data.orgnrs.length > 0) {
    body.orgnrs = data.orgnrs;
  } else if (data.list_id) {
    body.list_id = data.list_id;
  }
  const res = await apiFetch<{
    success: boolean;
    run_id: string;
    status: string;
    started_at?: string;
    stage1_count?: number;
    stage2_count?: number;
    stage3_count?: number;
    name?: string;
    list_id?: string;
    template_id?: string;
    template_name?: string;
    config?: { auto_approve?: boolean; overwrite_existing?: boolean };
  }>("/api/analysis/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapAnalysisRunToAIRun({
    run_id: res.run_id,
    status: res.status ?? "running",
    stage: 0,
    stage1_count: res.stage1_count,
    stage2_count: res.stage2_count,
    stage3_count: res.stage3_count,
    started_at: res.started_at ?? new Date().toISOString(),
    name: res.name,
    list_id: res.list_id,
    template_id: res.template_id,
    template_name: res.template_name,
    config: res.config,
  });
}

export async function cancelAIRun(runId: string): Promise<AIRun> {
  await apiFetch(`/api/analysis/runs/${runId}/cancel`, { method: "POST", body: JSON.stringify({}) });
  const run = await getAIRun(runId);
  if (!run) throw new Error("Run not found after cancel");
  return run;
}

// ---- AI Results (mapped to analysis run companies) ----

function mapCompanyAnalysisToAIResult(
  row: {
    orgnr: string;
    company_name?: string;
    strategic_fit_score?: number;
    recommendation?: string;
    result_status?: string;
    investment_memo?: string;
    swot_strengths?: string[];
    swot_weaknesses?: string[];
    swot_opportunities?: string[];
    swot_threats?: string[];
  },
  runId: string
): AIResult {
  const strengths = [
    ...(row.swot_strengths ?? []),
    ...(row.swot_opportunities ?? []),
  ];
  const concerns = [
    ...(row.swot_weaknesses ?? []),
    ...(row.swot_threats ?? []),
  ];
  const recMap: Record<string, AIResult["recommendation"]> = {
    strong_fit: "strong_fit",
    potential_fit: "potential_fit",
    weak_fit: "weak_fit",
    buy: "strong_fit",
    watch: "potential_fit",
    pass: "pass",
  };
  return {
    id: `${runId}::${row.orgnr}`,
    run_id: runId,
    company_orgnr: row.orgnr,
    status:
      row.result_status === "approved"
        ? "approved"
        : row.result_status === "rejected"
          ? "rejected"
          : "pending",
    overall_score: row.strategic_fit_score ?? 0,
    dimension_scores: {},
    summary: row.investment_memo ?? "",
    strengths,
    concerns,
    recommendation: recMap[row.recommendation ?? ""] ?? "potential_fit",
    prompt_used: "",
    tokens_used: 0,
    cost: 0,
    analyzed_at: new Date().toISOString(),
  };
}

export async function getRunResults(runId: string): Promise<AIResult[]> {
  try {
    const res = await apiFetch<unknown>(`/api/analysis/runs/${runId}/companies`);
    guardAnalysisRunCompaniesResponse(res);
    const r = res as { success: boolean; companies?: Array<{ orgnr: string; company_name?: string; strategic_fit_score?: number; recommendation?: string; result_status?: string; investment_memo?: string; swot_strengths?: string[]; swot_weaknesses?: string[]; swot_opportunities?: string[]; swot_threats?: string[] }> };
    setLastApiError(null);
    if (!r.companies) return [];
    return r.companies.map((c) => mapCompanyAnalysisToAIResult(c, runId));
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/analysis/runs/:id/companies");
    return [];
  }
}

export async function approveResult(resultId: string): Promise<AIResult> {
  await apiFetch(`/api/analysis/results/${encodeURIComponent(resultId)}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const [runId] = resultId.split("::");
  const results = await getRunResults(runId);
  const found = results.find((r) => r.id === resultId);
  if (!found) throw new Error("Result not found after approve");
  return found;
}

export async function rejectResult(resultId: string): Promise<AIResult> {
  await apiFetch(`/api/analysis/results/${encodeURIComponent(resultId)}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const [runId] = resultId.split("::");
  const results = await getRunResults(runId);
  const found = results.find((r) => r.id === resultId);
  if (!found) throw new Error("Result not found after reject");
  return found;
}

/** Financial year from /api/companies/{orgnr}/financials */
export type FinancialYear = {
  year: number;
  revenue_sek: number | null;
  profit_sek: number | null;
  ebit_sek: number | null;
  ebitda_sek: number | null;
  net_margin: number | null;
  ebit_margin: number | null;
  ebitda_margin: number | null;
};

export async function getCompanyFinancials(orgnr: string): Promise<{
  financials: FinancialYear[];
  count: number;
}> {
  const res = await apiFetch<{ financials: FinancialYear[]; count: number }>(
    `/api/companies/${orgnr}/financials`
  );
  return { financials: res.financials ?? [], count: res.count ?? 0 };
}

export async function getCompanyAIProfile(orgnr: string): Promise<AIProfile | null> {
  try {
    const row = await apiFetch<{
      orgnr: string;
      company_name?: string;
      strategic_fit_score?: number;
      recommendation?: string;
      investment_memo?: string;
      swot_strengths?: string[];
      swot_weaknesses?: string[];
    }>(`/api/analysis/companies/${orgnr}/analysis`);
    const result = mapCompanyAnalysisToAIResult(row, "unknown");
    return {
      company_orgnr: orgnr,
      ai_fit_score: row.strategic_fit_score ?? 0,
      last_analyzed: new Date().toISOString(),
      analysis_count: 1,
      latest_result: result,
    };
  } catch {
    return null;
  }
}

// ---- Universe filters (for createList from query) ----

export { getUniverseFilters };
