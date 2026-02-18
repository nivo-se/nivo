import type { CreateListDTO, List } from "@/lib/api/types";

export type ListModel = List;
export type CreateListRequest = CreateListDTO;

export interface CreateListFromUniverseQueryRequest {
  filters: Array<Record<string, unknown>>;
  logic?: "and";
  sort?: { by?: string; dir?: "asc" | "desc" };
  q?: string;
  max_items?: number;
  name: string;
  scope?: "private" | "team";
}
