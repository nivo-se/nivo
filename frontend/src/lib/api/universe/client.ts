import {
  getUniverseFilters,
  queryUniverse,
  type FilterTaxonomy,
  type UniverseQueryPayload,
  type UniverseQueryResponse,
} from "@/lib/services/universeQueryService";

export async function queryUniverseClient(
  payload: UniverseQueryPayload,
  signal?: AbortSignal
): Promise<UniverseQueryResponse> {
  return queryUniverse(payload, signal);
}

export async function getUniverseFiltersClient(): Promise<FilterTaxonomy> {
  return getUniverseFilters();
}
