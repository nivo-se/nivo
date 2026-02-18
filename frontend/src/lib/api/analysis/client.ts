import { requestJson } from "@/lib/api/httpClient";

export async function getAnalysisRunsClient(limit = 50) {
  return requestJson<{ success: boolean; runs?: Array<Record<string, unknown>> }>(
    `/api/analysis/runs?limit=${limit}`
  );
}

export async function getAnalysisRunClient(runId: string) {
  return requestJson<Record<string, unknown>>(`/api/analysis/runs/${runId}`);
}

export async function getAnalysisRunCompaniesClient(runId: string) {
  return requestJson<{ success: boolean; companies?: Array<Record<string, unknown>> }>(
    `/api/analysis/runs/${runId}/companies`
  );
}

export async function getAnalysisTemplatesClient() {
  return requestJson<{ items?: Array<Record<string, unknown>> }>("/api/analysis/templates");
}

export async function createAnalysisTemplateClient(payload: Record<string, unknown>) {
  return requestJson<Record<string, unknown>>("/api/analysis/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAnalysisTemplateClient(templateId: string, payload: Record<string, unknown>) {
  return requestJson<Record<string, unknown>>(`/api/analysis/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function duplicateAnalysisTemplateClient(templateId: string) {
  return requestJson<Record<string, unknown>>(`/api/analysis/templates/${templateId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function startAnalysisRunClient(payload: Record<string, unknown>) {
  return requestJson<Record<string, unknown>>("/api/analysis/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelAnalysisRunClient(runId: string) {
  return requestJson<{ success: boolean }>(`/api/analysis/runs/${runId}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function approveAnalysisResultClient(resultId: string) {
  return requestJson(`/api/analysis/results/${encodeURIComponent(resultId)}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectAnalysisResultClient(resultId: string) {
  return requestJson(`/api/analysis/results/${encodeURIComponent(resultId)}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
