/**
 * URL state for /new Universe. Persists q, page, sort, filters via ?u= JSON.
 * decodeNewUniverseState is fully defensive: invalid/malformed input returns null or safe defaults.
 */
export type NewUniverseUrlState = {
  v: 1;
  q?: string;
  page?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
  /** Include rules only (exclude not sent to backend for from_query) */
  filters?: { field: string; operator: string; value: unknown }[];
};

const PARAM_KEY = "u";

const SAFE_DEFAULTS: Partial<NewUniverseUrlState> = {
  q: undefined,
  page: 1,
  sortField: "name",
  sortDir: "asc",
  filters: undefined,
};

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

function isValidFilterRule(r: unknown): r is { field: string; operator: string; value: unknown } {
  return (
    r != null &&
    typeof r === "object" &&
    typeof (r as Record<string, unknown>).field === "string" &&
    typeof (r as Record<string, unknown>).operator === "string"
  );
}

export function decodeNewUniverseState(encoded: string | null): Partial<NewUniverseUrlState> | null {
  if (encoded == null) return null;
  if (typeof encoded !== "string") return null;
  const trimmed = encoded.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(safeDecodeURIComponent(trimmed));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;

  if (p.v !== 1) return null;

  const result: Partial<NewUniverseUrlState> = { v: 1 };

  if (typeof p.q === "string") result.q = p.q;
  else result.q = SAFE_DEFAULTS.q;

  if (typeof p.page === "number" && Number.isFinite(p.page) && p.page >= 1) result.page = Math.floor(p.page);
  else result.page = SAFE_DEFAULTS.page;

  if (typeof p.sortField === "string" && p.sortField) result.sortField = p.sortField;
  else result.sortField = SAFE_DEFAULTS.sortField;

  if (p.sortDir === "asc" || p.sortDir === "desc") result.sortDir = p.sortDir;
  else result.sortDir = SAFE_DEFAULTS.sortDir;

  if (Array.isArray(p.filters)) {
    result.filters = p.filters.filter(isValidFilterRule);
  } else {
    result.filters = SAFE_DEFAULTS.filters;
  }

  return result;
}

/** Dev-only: run decode against malformed examples. Returns true if no throw. */
export function runNewUniverseUrlStateDevTest(): boolean {
  if (import.meta.env.PROD) return true;
  const cases: { name: string; input: string | null }[] = [
    { name: "non-JSON", input: "not-valid-json{{" },
    { name: "missing fields", input: encodeURIComponent('{"v":1}') },
    { name: "wrong types", input: encodeURIComponent('{"v":1,"page":"two","sortDir":99,"filters":"x"}') },
  ];
  for (const c of cases) {
    try {
      decodeNewUniverseState(c.input);
    } catch (e) {
      console.error(`[newUniverseUrlState] Dev test FAIL: ${c.name}`, e);
      return false;
    }
  }
  return true;
}

export function getNewUniverseStateFromUrl(searchParams: URLSearchParams): Partial<NewUniverseUrlState> | null {
  return decodeNewUniverseState(searchParams.get(PARAM_KEY));
}

export function buildNewUniverseSearchParams(
  state: Omit<NewUniverseUrlState, "v">
): URLSearchParams {
  const params = new URLSearchParams();
  const encoded = encodeState(state);
  if (encoded && encoded.length < 3000) params.set(PARAM_KEY, encoded);
  return params;
}
