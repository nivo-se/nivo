import type { UniverseQueryPayload } from "@/lib/services/universeQueryService";
import type { Company } from "@/lib/api/types";

export type UniverseQuery = Partial<UniverseQueryPayload>;

export interface UniverseCompaniesResponse {
  companies: Company[];
  total: number;
}
