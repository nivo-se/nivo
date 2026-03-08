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
}

export interface AnalysisStatus {
  run_id: string
  company_id: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_stage: string
  stages: RunStage[]
}

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
}

export interface ReportVersion {
  report_version_id: string
  run_id: string
  company_id?: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  title: string | null
  version_number: number | null
  sections?: ReportSection[]
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

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface StartAnalysisRequest {
  company_id?: string
  orgnr?: string
  company_name?: string
  website?: string
  query?: string
  analysis_type?: 'full' | 'refresh' | 'quick'
  priority?: 'low' | 'normal' | 'high'
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

export async function listRuns(): Promise<AnalysisStatus[] | null> {
  return drFetch<AnalysisStatus[]>('/analysis/runs')
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function getLatestReport(companyId: string): Promise<ReportVersion | null> {
  return drFetch<ReportVersion>(`/reports/company/${companyId}/latest`)
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
