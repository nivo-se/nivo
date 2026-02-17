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
  return {
    orgnr: String(row.orgnr ?? ""),
    display_name: row.name ?? row.orgnr ?? "",
    legal_name: row.name ?? row.orgnr ?? "",
    industry_label: Array.isArray(row.segment_names) ? row.segment_names[0] ?? "Unknown" : "Unknown",
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

export async function updateList(_listId: string, _data: Partial<List>): Promise<List> {
  // Nivo backend does not have PUT /lists/:id - stub
  throw new Error("updateList not implemented in backend");
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

// ---- Prospects (stubbed - not in Nivo backend) ----

export async function getProspects(): Promise<ProspectStatus[]> {
  return [];
}

export async function getProspect(_prospectId: string): Promise<ProspectStatus | null> {
  return null;
}

export async function createProspect(_companyId: string): Promise<ProspectStatus> {
  throw new Error("Prospects not implemented in backend");
}

export async function updateProspectStatus(
  _prospectId: string,
  _updates: Partial<ProspectStatus>
): Promise<ProspectStatus> {
  throw new Error("Prospects not implemented in backend");
}

export async function addProspectNote(
  _prospectId: string,
  _note: { text: string; author: string }
): Promise<ProspectStatus> {
  throw new Error("Prospects not implemented in backend");
}

export async function updateProspectNote(
  _prospectId: string,
  _noteIndex: number,
  _text: string
): Promise<ProspectStatus> {
  throw new Error("Prospects not implemented in backend");
}

export async function deleteProspectNote(
  _prospectId: string,
  _noteIndex: number
): Promise<void> {
  throw new Error("Prospects not implemented in backend");
}

// ---- AI Templates (built-in defaults from Figma export; backend CRUD stubbed) ----

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  return [...DEFAULT_PROMPT_TEMPLATES];
}

export async function getPromptTemplate(
  templateId: string
): Promise<PromptTemplate | null> {
  const found = DEFAULT_PROMPT_TEMPLATES.find((t) => t.id === templateId);
  return found ?? null;
}

export async function createPromptTemplate(
  _data: Omit<PromptTemplate, "id" | "created_at" | "created_by">
): Promise<PromptTemplate> {
  throw new Error("AI templates not implemented in backend");
}

export async function updatePromptTemplate(
  _templateId: string,
  _data: Partial<PromptTemplate>
): Promise<PromptTemplate> {
  throw new Error("AI templates not implemented in backend");
}

export async function duplicatePromptTemplate(_templateId: string): Promise<PromptTemplate> {
  throw new Error("AI templates not implemented in backend");
}

// ---- AI Runs (mapped to Nivo /api/analysis) ----

function mapAnalysisRunToAIRun(r: {
  run_id: string;
  status: string;
  stage: number;
  stage1_count?: number;
  stage2_count?: number;
  stage3_count?: number;
  started_at: string;
  completed_at?: string;
}): AIRun {
  const total = r.stage3_count ?? r.stage2_count ?? r.stage1_count ?? 0;
  const statusMap: Record<string, AIRun["status"]> = {
    running: "running",
    completed: "completed",
    failed: "failed",
    queued: "queued",
  };
  return {
    id: r.run_id,
    name: `Run ${r.run_id.slice(0, 8)}`,
    list_id: "",
    template_id: "",
    status: statusMap[r.status] ?? "queued",
    created_at: r.started_at,
    created_by: "system",
    started_at: r.started_at,
    completed_at: r.completed_at,
    total_companies: total,
    processed_companies: total,
    failed_companies: 0,
    estimated_cost: 0,
    actual_cost: 0,
    config: { auto_approve: false, overwrite_existing: false },
  };
}

export async function getAIRuns(): Promise<AIRun[]> {
  try {
    const res = await apiFetch<unknown>("/api/analysis/runs?limit=50");
    guardAnalysisRunsResponse(res);
    const r = res as { success: boolean; runs?: Array<{ run_id: string; status: string; stage: number; stage1_count?: number; stage2_count?: number; stage3_count?: number; started_at: string; completed_at?: string }> };
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
    const r = await apiFetch<unknown>(`/api/analysis/runs/${runId}`);
    guardAnalysisRunResponse(r);
    setLastApiError(null);
    return mapAnalysisRunToAIRun(r as Parameters<typeof mapAnalysisRunToAIRun>[0]);
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/analysis/runs/:id");
    return null;
  }
}

export async function createAIRun(data: CreateAIRunDTO): Promise<AIRun> {
  // Nivo analysis/start uses filter criteria, not list_id/template_id.
  // Start with default criteria; full list/template support would need backend changes.
  const res = await apiFetch<{
    success: boolean;
    run_id: string;
    status: string;
    stage1_count?: number;
    stage2_count?: number;
    stage3_count?: number;
  }>("/api/analysis/start", {
    method: "POST",
    body: JSON.stringify({
      min_revenue: 10_000_000,
      min_ebitda_margin: 0.05,
      min_growth: 0.1,
      max_results: 500,
    }),
  });
  return mapAnalysisRunToAIRun({
    run_id: res.run_id,
    status: res.status ?? "running",
    stage: 1,
    stage1_count: res.stage1_count,
    stage2_count: res.stage2_count,
    stage3_count: res.stage3_count,
    started_at: new Date().toISOString(),
  });
}

export async function cancelAIRun(_runId: string): Promise<AIRun> {
  throw new Error("cancelAIRun not implemented in backend");
}

// ---- AI Results (mapped to analysis run companies) ----

function mapCompanyAnalysisToAIResult(
  row: {
    orgnr: string;
    company_name?: string;
    strategic_fit_score?: number;
    recommendation?: string;
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
    pass: "pass",
  };
  return {
    id: `${runId}-${row.orgnr}`,
    run_id: runId,
    company_orgnr: row.orgnr,
    status: "pending",
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
    const r = res as { success: boolean; companies?: Array<{ orgnr: string; company_name?: string; strategic_fit_score?: number; recommendation?: string; investment_memo?: string; swot_strengths?: string[]; swot_weaknesses?: string[]; swot_opportunities?: string[]; swot_threats?: string[] }> };
    setLastApiError(null);
    if (!r.companies) return [];
    return r.companies.map((c) => mapCompanyAnalysisToAIResult(c, runId));
  } catch (e) {
    setLastApiError(e instanceof Error ? e.message : String(e), "GET /api/analysis/runs/:id/companies");
    return [];
  }
}

export async function approveResult(_resultId: string): Promise<AIResult> {
  throw new Error("approveResult not implemented in backend");
}

export async function rejectResult(_resultId: string): Promise<AIResult> {
  throw new Error("rejectResult not implemented in backend");
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
