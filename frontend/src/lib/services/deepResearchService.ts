/**
 * Deep Research API client.
 * Wraps all /api/deep-research/ endpoints with typed request/response.
 */
import { fetchWithAuth } from '@/lib/backendFetch'
import { API_BASE } from '@/lib/apiClient'

const DR_BASE = `${API_BASE}/api/deep-research`

// ---------------------------------------------------------------------------
// Types — mirror backend models/deep_research_api.py
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: { code: string; message: string; details?: Record<string, unknown> } | null
  meta: { request_id?: string; timestamp?: string; version?: string }
}

export interface RunStage {
  stage: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  started_at: string | null
  finished_at: string | null
  error_message?: string | null
  /** Stage output from orchestrator (e.g. skipped reason, blocked_reasons) */
  output?: Record<string, unknown>
}

export interface AnalysisStatus {
  run_id: string
  company_id: string | null
  company_name: string | null
  orgnr?: string | null
  created_at?: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_stage: string
  stages: RunStage[]
  error_message?: string | null
  diagnostics?: RunDiagnostics | null
  report_quality_status?: string | null
}

/** Run diagnostics for observability (admin/debug) */
export interface RunDiagnostics {
  stage_durations?: Record<string, number>
  failure_reason_codes?: string[]
  evidence_accepted_count?: number | null
  evidence_rejected_count?: number | null
  assumption_valuation_ready?: boolean | null
  assumption_blocked_reasons?: string[]
  valuation_skipped?: boolean
  report_degraded?: boolean
  report_quality_status?: string | null
  report_quality_reason_codes?: string[]
  report_quality_limitation_summary?: string[]
}

/** Unified run summary for Deep Research Home list display */
export interface ResearchRunSummary {
  run_id: string
  company_id: string | null
  company_name: string | null
  orgnr?: string | null
  created_at: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_stage: string
  confidence?: number | null
}

/** Research mode for New Report wizard */
export type ResearchMode = 'quick' | 'standard' | 'full'

export interface AnalysisStartResult {
  run_id: string
  status: string
  message: string
  accepted_at: string
}

export interface ReportSection {
  section_key: string
  heading: string | null
  content_md: string
  sort_order: number
  extra?: Record<string, unknown>
}

export interface ValidationStatus {
  lint_passed: boolean
  lint_warnings: string[]
}

export interface ReportVersion {
  report_version_id: string
  run_id: string
  company_id?: string | null
  company_name?: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  title: string | null
  version_number: number | null
  sections?: ReportSection[]
  report_degraded?: boolean
  report_degraded_reasons?: string[]
  report_quality_status?: string | null
  report_quality_limitation_summary?: string[]
  validation_status?: ValidationStatus | null
}

/** Report-level status for UX trust signals */
export type ReportLevelStatus =
  | 'complete'
  | 'complete_with_limitations'
  | 'blocked'
  | 'failed'

export interface CompanyWithReport {
  company_id: string
  company_name: string
  latest_report_id: string | null
  latest_report_title: string | null
  updated_at: string | null
  run_count: number
}

export interface CompetitorItem {
  competitor_id: string
  name: string
  relation_score: number | null
  website: string | null
}

export interface CompetitorList {
  company_id: string
  items: CompetitorItem[]
}

export interface VerificationResult {
  verification_id: string
  run_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  issues: string[]
  stats: Record<string, unknown>
}

export interface RecomputeResult {
  job_id: string
  report_version_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
}

export interface HealthDependencyData {
  name: string
  enabled: boolean
  healthy: boolean | null
  message: string | null
}

export interface DeepResearchHealthData {
  service: string
  environment: string
  dependencies: HealthDependencyData[]
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface UserSourceInput {
  source_type: 'url' | 'document' | 'note'
  url?: string
  raw_text?: string
  title?: string
}

export interface StartAnalysisRequest {
  company_id?: string
  orgnr?: string
  company_name?: string
  website?: string
  query?: string
  analysis_type?: 'full' | 'refresh' | 'quick'
  priority?: 'low' | 'normal' | 'high'
  sources?: UserSourceInput[]
}

export interface RecomputeReportRequest {
  report_version_id: string
  include_sections?: string[]
  reason?: string
}

export interface RecomputeSectionRequest {
  report_version_id: string
  section_key: string
  instructions?: string
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function drFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetchWithAuth(`${DR_BASE}${path}`, options)
    if (!res.ok) return null
    const body: ApiResponse<T> = await res.json()
    return body.data ?? null
  } catch {
    return null
  }
}

async function drPost<T>(path: string, payload: unknown): Promise<T | null> {
  return drFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// ---------------------------------------------------------------------------
// Analysis runs
// ---------------------------------------------------------------------------

export async function startAnalysis(req: StartAnalysisRequest): Promise<AnalysisStartResult | null> {
  return drPost<AnalysisStartResult>('/analysis/start', req)
}

export async function getRunStatus(runId: string): Promise<AnalysisStatus | null> {
  return drFetch<AnalysisStatus>(`/analysis/runs/${runId}`)
}

export type RestartResult = { success: true; data: AnalysisStartResult } | { success: false; error: string }

export async function restartRun(runId: string): Promise<RestartResult> {
  const res = await fetchWithAuth(`${DR_BASE}/analysis/runs/${runId}/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const bodyText = await res.text()
  let parsed: ApiResponse<AnalysisStartResult> & { detail?: string } | null = null
  try {
    parsed = JSON.parse(bodyText) as ApiResponse<AnalysisStartResult> & { detail?: string }
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = parsed?.detail ?? parsed?.error?.message ?? `HTTP ${res.status}`
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) }
  }
  const data = parsed?.data ?? null
  if (!data) return { success: false, error: 'No data in response' }
  return { success: true, data }
}

export async function getDeepResearchHealth(): Promise<DeepResearchHealthData | null> {
  return drFetch<DeepResearchHealthData>('/health')
}

export async function listRuns(): Promise<AnalysisStatus[] | null> {
  return drFetch<AnalysisStatus[]>('/analysis/runs')
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function listCompaniesWithReports(): Promise<CompanyWithReport[] | null> {
  return drFetch<CompanyWithReport[]>('/companies')
}

export async function getCompany(companyId: string): Promise<CompanyWithReport | null> {
  return drFetch<CompanyWithReport>(`/companies/${companyId}`)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function getLatestReport(companyId: string): Promise<ReportVersion | null> {
  return drFetch<ReportVersion>(`/reports/company/${companyId}/latest`)
}

export async function getLatestReportForRun(runId: string): Promise<ReportVersion | null> {
  return drFetch<ReportVersion>(`/reports/run/${runId}/latest`)
}

export async function getReportVersion(versionId: string): Promise<ReportVersion | null> {
  return drFetch<ReportVersion>(`/reports/versions/${versionId}`)
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function getVerification(runId: string): Promise<VerificationResult | null> {
  return drFetch<VerificationResult>(`/verification/runs/${runId}`)
}

export async function runVerification(runId: string, strictMode = false): Promise<VerificationResult | null> {
  return drPost<VerificationResult>('/verification/run', { run_id: runId, strict_mode: strictMode })
}

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export async function getCompetitors(companyId: string): Promise<CompetitorList | null> {
  return drFetch<CompetitorList>(`/competitors/company/${companyId}`)
}

// ---------------------------------------------------------------------------
// Recompute
// ---------------------------------------------------------------------------

export async function recomputeReport(req: RecomputeReportRequest): Promise<RecomputeResult | null> {
  return drPost<RecomputeResult>('/recompute/report', req)
}

export async function recomputeSection(req: RecomputeSectionRequest): Promise<RecomputeResult | null> {
  return drPost<RecomputeResult>('/recompute/section', req)
}
