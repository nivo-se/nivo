/**
 * Response shape guards for figmaApi endpoints.
 * Throws descriptive errors when API response is invalid.
 */

// Universe query: { rows: UniverseRow[], total: number }
export function guardUniverseQueryResponse(data: unknown): asserts data is { rows: unknown[]; total: number } {
  if (!data || typeof data !== "object") {
    throw new Error("Universe API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.rows)) {
    throw new Error("Universe API: missing or invalid 'rows' array");
  }
  if (typeof d.total !== "number" && d.total !== undefined) {
    throw new Error("Universe API: 'total' must be a number");
  }
}

// Lists: { items: SavedList[] }
export function guardListsResponse(data: unknown): asserts data is { items: unknown[] } {
  if (!data || typeof data !== "object") {
    throw new Error("Lists API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.items)) {
    throw new Error("Lists API: missing or invalid 'items' array");
  }
}

// List items: { list_id: string; items: { orgnr: string; added_by: string; added_at: string }[] }
export function guardListItemsResponse(data: unknown): asserts data is { list_id: string; items: unknown[] } {
  if (!data || typeof data !== "object") {
    throw new Error("List items API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (typeof d.list_id !== "string") {
    throw new Error("List items API: missing or invalid 'list_id'");
  }
  if (!Array.isArray(d.items)) {
    throw new Error("List items API: missing or invalid 'items' array");
  }
}

// Analysis runs: { success: boolean; runs?: array }
export function guardAnalysisRunsResponse(
  data: unknown
): asserts data is { success: boolean; runs?: unknown[] } {
  if (!data || typeof data !== "object") {
    throw new Error("Analysis runs API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (d.success !== true && d.success !== false) {
    throw new Error("Analysis runs API: missing or invalid 'success' field");
  }
  if (d.runs !== undefined && !Array.isArray(d.runs)) {
    throw new Error("Analysis runs API: 'runs' must be an array when present");
  }
}

// Analysis run detail: { run_id: string; status: string; started_at: string; ... }
export function guardAnalysisRunResponse(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw new Error("Analysis run API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (typeof d.run_id !== "string") {
    throw new Error("Analysis run API: missing or invalid 'run_id'");
  }
}

// Companies batch: { companies: array; count: number }
export function guardCompaniesBatchResponse(
  data: unknown
): asserts data is { companies: unknown[]; count: number } {
  if (!data || typeof data !== "object") {
    throw new Error("Companies batch API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.companies)) {
    throw new Error("Companies batch API: missing or invalid 'companies' array");
  }
  if (typeof d.count !== "number") {
    throw new Error("Companies batch API: missing or invalid 'count'");
  }
}

// Analysis run companies: { success: boolean; companies?: array }
export function guardAnalysisRunCompaniesResponse(
  data: unknown
): asserts data is { success: boolean; companies?: unknown[] } {
  if (!data || typeof data !== "object") {
    throw new Error("Analysis run companies API: response is not an object");
  }
  const d = data as Record<string, unknown>;
  if (d.success !== true && d.success !== false) {
    throw new Error("Analysis run companies API: missing or invalid 'success' field");
  }
  if (d.companies !== undefined && !Array.isArray(d.companies)) {
    throw new Error("Analysis run companies API: 'companies' must be an array when present");
  }
}
