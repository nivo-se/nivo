import { DEFAULT_PROMPT_TEMPLATES } from "@/lib/defaultPromptTemplates";
import {
  approveAnalysisResultClient,
  cancelAnalysisRunClient,
  createAnalysisTemplateClient,
  duplicateAnalysisTemplateClient,
  getAnalysisRunClient,
  getAnalysisRunCompaniesClient,
  getAnalysisRunsClient,
  getAnalysisTemplatesClient,
  rejectAnalysisResultClient,
  startAnalysisRunClient,
  updateAnalysisTemplateClient,
} from "@/lib/api/analysis/client";
import type {
  AnalysisResult,
  AnalysisRun,
  CreateAnalysisRunDTO,
  PromptTemplate,
} from "@/lib/api/types";

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

function mapTemplate(row: Record<string, unknown>): PromptTemplate {
  return {
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
  };
}

function mapAnalysisRunToRun(r: AnalysisRunApi): AnalysisRun {
  const total = r.stage1_count ?? r.stage2_count ?? r.stage3_count ?? 0;
  const processed = r.stage3_count ?? 0;
  const statusMap: Record<string, AnalysisRun["status"]> = {
    running: "running",
    stage_1_complete: "running",
    stage_2_complete: "running",
    complete: "completed",
    completed: "completed",
    failed: "failed",
    queued: "queued",
    cancelled: "cancelled",
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
    actual_cost:
      r.status === "complete" || r.status === "completed"
        ? processed * perCompanyEstimate
        : 0,
    config: {
      auto_approve: cfg.auto_approve === true,
      overwrite_existing: cfg.overwrite_existing === true,
    },
  };
}

function parseDimensionScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
  }
  return out;
}

function mapCompanyAnalysisToResult(
  row: {
    orgnr: string;
    strategic_fit_score?: number;
    recommendation?: string;
    result_status?: string;
    investment_memo?: string;
    swot_strengths?: string[];
    swot_weaknesses?: string[];
    swot_opportunities?: string[];
    swot_threats?: string[];
    dimension_scores?: unknown;
  },
  runId: string
): AnalysisResult {
  const strengths = [...(row.swot_strengths ?? []), ...(row.swot_opportunities ?? [])];
  const concerns = [...(row.swot_weaknesses ?? []), ...(row.swot_threats ?? [])];

  const recMap: Record<string, AnalysisResult["recommendation"]> = {
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
    dimension_scores: parseDimensionScores(row.dimension_scores),
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

export async function getAnalysisTemplates(): Promise<PromptTemplate[]> {
  try {
    const res = await getAnalysisTemplatesClient();
    const items = (res.items ?? []).map((row) => mapTemplate(row));
    if (items.length > 0) return items;
  } catch {
    // fallback
  }
  return [...DEFAULT_PROMPT_TEMPLATES];
}

export async function getAnalysisTemplate(templateId: string): Promise<PromptTemplate | null> {
  const templates = await getAnalysisTemplates();
  return templates.find((t) => t.id === templateId) ?? null;
}

export async function createAnalysisTemplate(
  data: Omit<PromptTemplate, "id" | "created_at" | "created_by">
): Promise<PromptTemplate> {
  const row = await createAnalysisTemplateClient({
    name: data.name,
    description: data.description,
    prompt: data.prompt,
    variables: data.variables,
    scoring_dimensions: data.scoringDimensions,
  });
  return mapTemplate(row);
}

export async function updateAnalysisTemplate(
  templateId: string,
  data: Partial<PromptTemplate>
): Promise<PromptTemplate> {
  const row = await updateAnalysisTemplateClient(templateId, {
    name: data.name,
    description: data.description,
    prompt: data.prompt,
    variables: data.variables,
    scoring_dimensions: data.scoringDimensions,
  });
  return mapTemplate(row);
}

export async function duplicateAnalysisTemplate(templateId: string): Promise<PromptTemplate> {
  const row = await duplicateAnalysisTemplateClient(templateId);
  return mapTemplate(row);
}

export async function getAnalysisRuns(): Promise<AnalysisRun[]> {
  const res = await getAnalysisRunsClient(50);
  const runs = Array.isArray(res.runs) ? (res.runs as AnalysisRunApi[]) : [];
  return runs.map((r) => mapAnalysisRunToRun(r));
}

export async function getAnalysisRun(runId: string): Promise<AnalysisRun | null> {
  try {
    const row = (await getAnalysisRunClient(runId)) as unknown as AnalysisRunApi;
    return mapAnalysisRunToRun(row);
  } catch {
    return null;
  }
}

export async function createAnalysisRun(data: CreateAnalysisRunDTO): Promise<AnalysisRun> {
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

  if (data.orgnrs?.length) body.orgnrs = data.orgnrs;
  else if (data.list_id) body.list_id = data.list_id;

  const res = await startAnalysisRunClient(body);
  return mapAnalysisRunToRun({
    run_id: String(res.run_id ?? ""),
    status: String(res.status ?? "running"),
    stage: 0,
    stage1_count: typeof res.stage1_count === "number" ? res.stage1_count : undefined,
    stage2_count: typeof res.stage2_count === "number" ? res.stage2_count : undefined,
    stage3_count: typeof res.stage3_count === "number" ? res.stage3_count : undefined,
    started_at: String(res.started_at ?? new Date().toISOString()),
    name: typeof res.name === "string" ? res.name : undefined,
    list_id: typeof res.list_id === "string" ? res.list_id : undefined,
    template_id: typeof res.template_id === "string" ? res.template_id : undefined,
    template_name: typeof res.template_name === "string" ? res.template_name : undefined,
    config:
      typeof res.config === "object" && res.config
        ? (res.config as { auto_approve?: boolean; overwrite_existing?: boolean })
        : undefined,
  });
}

export async function cancelAnalysisRun(runId: string): Promise<AnalysisRun> {
  await cancelAnalysisRunClient(runId);
  const run = await getAnalysisRun(runId);
  if (!run) throw new Error("Run not found after cancel");
  return run;
}

export async function getAnalysisRunResults(runId: string): Promise<AnalysisResult[]> {
  try {
    const res = await getAnalysisRunCompaniesClient(runId);
    const companies = Array.isArray(res.companies) ? res.companies : [];
    return companies.map((c) =>
      mapCompanyAnalysisToResult(
        {
          orgnr: String(c.orgnr ?? ""),
          strategic_fit_score:
            typeof c.strategic_fit_score === "number" ? c.strategic_fit_score : undefined,
          recommendation: typeof c.recommendation === "string" ? c.recommendation : undefined,
          result_status: typeof c.result_status === "string" ? c.result_status : undefined,
          investment_memo: typeof c.investment_memo === "string" ? c.investment_memo : undefined,
          swot_strengths: Array.isArray(c.swot_strengths) ? c.swot_strengths.map(String) : undefined,
          swot_weaknesses: Array.isArray(c.swot_weaknesses) ? c.swot_weaknesses.map(String) : undefined,
          swot_opportunities: Array.isArray(c.swot_opportunities) ? c.swot_opportunities.map(String) : undefined,
          swot_threats: Array.isArray(c.swot_threats) ? c.swot_threats.map(String) : undefined,
          dimension_scores: c.dimension_scores,
        },
        runId
      )
    );
  } catch {
    return [];
  }
}

export async function approveAnalysisResult(resultId: string): Promise<AnalysisResult> {
  await approveAnalysisResultClient(resultId);
  const [runId] = resultId.split("::");
  const results = await getAnalysisRunResults(runId);
  const found = results.find((r) => r.id === resultId);
  if (!found) throw new Error("Result not found after approve");
  return found;
}

export async function rejectAnalysisResult(resultId: string): Promise<AnalysisResult> {
  await rejectAnalysisResultClient(resultId);
  const [runId] = resultId.split("::");
  const results = await getAnalysisRunResults(runId);
  const found = results.find((r) => r.id === resultId);
  if (!found) throw new Error("Result not found after reject");
  return found;
}
