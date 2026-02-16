/**
 * URL state encoding for Universe page.
 * Single param ?u= with encodeURIComponent(JSON) for shareable filter state.
 */

import type { FilterItem } from "./services/universeQueryService";

export type UniverseUrlStateV1 = {
  v: 1;
  q?: string;
  filters?: FilterItem[];
  sort?: { by: string; dir: "asc" | "desc" };
  offset?: number;
  preset?: string | null;
};

const PARAM_KEY = "u";

export function encodeUniverseState(state: Omit<UniverseUrlStateV1, "v">): string {
  const payload: UniverseUrlStateV1 = { v: 1, ...state };
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeUniverseState(encoded: string | null): Partial<UniverseUrlStateV1> | null {
  if (!encoded || encoded.trim() === "") return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as UniverseUrlStateV1;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getUniverseStateFromUrl(searchParams: URLSearchParams): Partial<UniverseUrlStateV1> | null {
  const u = searchParams.get(PARAM_KEY);
  return decodeUniverseState(u);
}

export function buildUniverseSearchParams(state: Omit<UniverseUrlStateV1, "v">): URLSearchParams {
  const params = new URLSearchParams();
  const encoded = encodeUniverseState(state);
  if (encoded && encoded.length < 2000) {
    params.set(PARAM_KEY, encoded);
  }
  return params;
}
