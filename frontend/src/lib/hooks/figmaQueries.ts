/**
 * React Query hooks for Figma export API.
 * Use when migrating nivo-figma-app pages to Nivo frontend.
 *
 * Replace useData() with these hooks. See docs/FIGMA_MIGRATION.md.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as api from "@/lib/services/figmaApi";
import type { UniverseQueryPayload } from "@/lib/services/universeQueryService";
import type { CreateListDTO, CreateAIRunDTO } from "@/types/figma";

// ---- Companies ----

export function useCompanies(payload?: Partial<UniverseQueryPayload>) {
  return useQuery({
    queryKey: [
      "figma", "companies",
      payload?.offset ?? 0,
      payload?.limit ?? 50,
      payload?.q ?? "",
      JSON.stringify(payload?.sort ?? {}),
      JSON.stringify(payload?.filters ?? []),
    ],
    queryFn: ({ signal }) => api.getCompanies(payload, signal),
  });
}

/** Like useCompanies but also returns total from universe query. */
export function useCompaniesWithTotal(payload?: Partial<UniverseQueryPayload>) {
  return useQuery({
    queryKey: [
      "figma", "companies", "withTotal",
      payload?.offset ?? 0,
      payload?.limit ?? 50,
      payload?.q ?? "",
      JSON.stringify(payload?.sort ?? {}),
      JSON.stringify(payload?.filters ?? []),
    ],
    queryFn: async ({ signal }) => api.getCompaniesWithTotal(payload, signal),
  });
}

export function useCompany(orgnr: string, enabled = true) {
  return useQuery({
    queryKey: ["figma", "companies", orgnr],
    queryFn: () => api.getCompany(orgnr),
    enabled: !!orgnr && enabled,
  });
}

export function useSearchCompanies(query: string, limit = 50) {
  return useQuery({
    queryKey: ["figma", "companies", "search", query, limit],
    queryFn: () => api.searchCompanies(query, limit),
    enabled: query.trim().length >= 2,
  });
}

// ---- Lists ----

export function useLists(options?: Omit<UseQueryOptions<Awaited<ReturnType<typeof api.getLists>>, Error>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["figma", "lists"],
    queryFn: api.getLists,
    ...options,
  });
}

export function useList(listId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "lists", listId ?? ""],
    queryFn: () => api.getList(listId!),
    enabled: !!listId && enabled,
  });
}

export function useCreateList(
  mutationOptions?: UseMutationOptions<Awaited<ReturnType<typeof api.createList>>, Error, CreateListDTO>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createList,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Parameters<typeof api.updateList>[1] }) =>
      api.updateList(listId, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["figma", "lists", variables.listId] });
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteList,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
    },
  });
}

export function useAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnrs }: { listId: string; orgnrs: string[] }) =>
      api.addToList(listId, orgnrs),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
      qc.invalidateQueries({ queryKey: ["figma", "lists", variables.listId] });
    },
  });
}

export function useRemoveFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnr }: { listId: string; orgnr: string }) =>
      api.removeFromList(listId, orgnr),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
      qc.invalidateQueries({ queryKey: ["figma", "lists", variables.listId] });
    },
  });
}

const BATCH_ORGNRS_MAX = 500;

export function useCompaniesBatch(
  orgnrs: string[],
  options?: { autoEnrich?: boolean }
) {
  const capped = orgnrs.length > BATCH_ORGNRS_MAX ? orgnrs.slice(0, BATCH_ORGNRS_MAX) : orgnrs;
  const isTruncated = orgnrs.length > BATCH_ORGNRS_MAX;
  const query = useQuery({
    queryKey: ["figma", "companies", "batch", capped.slice().sort(), options?.autoEnrich],
    queryFn: () => api.getCompaniesBatch(capped, options),
    enabled: capped.length > 0,
  });
  return { ...query, isTruncated, totalRequested: orgnrs.length };
}

export function useCreateListFromQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createListFromUniverseQuery>[0]) =>
      api.createListFromUniverseQuery(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["figma", "lists"] });
    },
  });
}

// ---- Prospects (stubbed) ----

export function useProspects() {
  return useQuery({
    queryKey: ["figma", "prospects"],
    queryFn: api.getProspects,
  });
}

// ---- AI Templates (stubbed) ----

export function usePromptTemplates() {
  return useQuery({
    queryKey: ["figma", "promptTemplates"],
    queryFn: api.getPromptTemplates,
  });
}

export function usePromptTemplate(templateId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "promptTemplates", templateId ?? ""],
    queryFn: () => api.getPromptTemplate(templateId!),
    enabled: !!templateId && enabled,
  });
}

// ---- AI Runs ----

export function useAIRuns() {
  return useQuery({
    queryKey: ["figma", "aiRuns"],
    queryFn: api.getAIRuns,
  });
}

export function useAIRun(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "aiRuns", runId ?? ""],
    queryFn: () => api.getAIRun(runId!),
    enabled: !!runId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "running" || data?.status === "queued" ? 2000 : false;
    },
  });
}

export function useCreateAIRun(
  mutationOptions?: UseMutationOptions<Awaited<ReturnType<typeof api.createAIRun>>, Error, CreateAIRunDTO>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAIRun,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: ["figma", "aiRuns"] });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export function useCancelAIRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.cancelAIRun(runId),
    onSuccess: (_, runId) => {
      qc.invalidateQueries({ queryKey: ["figma", "aiRuns", runId] });
      qc.invalidateQueries({ queryKey: ["figma", "aiRuns"] });
    },
  });
}

export function useRunResults(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "aiRuns", runId ?? "", "results"],
    queryFn: () => api.getRunResults(runId!),
    enabled: !!runId && enabled,
  });
}

export function useCompanyAIProfile(orgnr: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "aiProfiles", orgnr ?? ""],
    queryFn: () => api.getCompanyAIProfile(orgnr!),
    enabled: !!orgnr && enabled,
    retry: false, // 404 is expected when no analysis exists
  });
}

export function useCompanyFinancials(orgnr: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["figma", "companies", orgnr ?? "", "financials"],
    queryFn: () => api.getCompanyFinancials(orgnr!),
    enabled: !!orgnr && enabled,
  });
}
