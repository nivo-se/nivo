/**
 * React Query hooks for the domain API services.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getCompanyAnalysisProfile,
  getCompanyByOrgnr,
  getCompanyFinancialHistory,
  getCompaniesBatchDetails,
  searchCompanySummaries,
} from "@/lib/api/companies/service";
import {
  cancelAnalysisRun,
  createAnalysisRun,
  getAnalysisRun,
  getAnalysisRunResults,
  getAnalysisRuns,
  getAnalysisTemplate,
  getAnalysisTemplates,
} from "@/lib/api/analysis/service";
import {
  addCompaniesToList,
  createListEntry,
  createListFromUniverseFilters,
  deleteListEntry,
  getAllLists,
  getListById,
  removeCompanyFromList,
  updateListEntry,
} from "@/lib/api/lists/service";
import { getProspects } from "@/lib/api/prospects/service";
import {
  getUniverseCompanies,
  getUniverseCompaniesWithTotal,
} from "@/lib/api/universe/service";
import type { CreateAnalysisRunDTO, CreateListDTO } from "@/lib/api/types";
import type { UniverseQueryPayload } from "@/lib/services/universeQueryService";

export function useCompanies(payload?: Partial<UniverseQueryPayload>) {
  return useQuery({
    queryKey: [
      "app", "companies",
      payload?.offset ?? 0,
      payload?.limit ?? 50,
      payload?.q ?? "",
      JSON.stringify(payload?.sort ?? {}),
      JSON.stringify(payload?.filters ?? []),
    ],
    queryFn: ({ signal }) => getUniverseCompanies(payload, signal),
  });
}

export function useCompaniesWithTotal(payload?: Partial<UniverseQueryPayload>) {
  return useQuery({
    queryKey: [
      "app", "companies", "withTotal",
      payload?.offset ?? 0,
      payload?.limit ?? 50,
      payload?.q ?? "",
      JSON.stringify(payload?.sort ?? {}),
      JSON.stringify(payload?.filters ?? []),
    ],
    queryFn: ({ signal }) => getUniverseCompaniesWithTotal(payload, signal),
  });
}

export function useCompany(orgnr: string, enabled = true) {
  return useQuery({
    queryKey: ["app", "companies", orgnr],
    queryFn: () => getCompanyByOrgnr(orgnr),
    enabled: !!orgnr && enabled,
  });
}

export function useSearchCompanies(query: string, limit = 50) {
  return useQuery({
    queryKey: ["app", "companies", "search", query, limit],
    queryFn: () => searchCompanySummaries(query, limit),
    enabled: query.trim().length >= 2,
  });
}

export function useLists(
  options?: Omit<UseQueryOptions<Awaited<ReturnType<typeof getAllLists>>, Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: ["app", "lists"],
    queryFn: getAllLists,
    staleTime: 0,
    refetchOnMount: "always",
    ...options,
  });
}

export function useList(listId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "lists", listId ?? ""],
    queryFn: () => getListById(listId!),
    enabled: !!listId && enabled,
  });
}

export function useCreateList(
  mutationOptions?: UseMutationOptions<Awaited<ReturnType<typeof createListEntry>>, Error, CreateListDTO>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createListEntry,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Parameters<typeof updateListEntry>[1] }) =>
      updateListEntry(listId, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["app", "lists", variables.listId] });
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteListEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
    },
  });
}

export function useAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnrs }: { listId: string; orgnrs: string[] }) =>
      addCompaniesToList(listId, orgnrs),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
      qc.invalidateQueries({ queryKey: ["app", "lists", variables.listId] });
    },
  });
}

export function useRemoveFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnr }: { listId: string; orgnr: string }) =>
      removeCompanyFromList(listId, orgnr),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
      qc.invalidateQueries({ queryKey: ["app", "lists", variables.listId] });
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
    queryKey: ["app", "companies", "batch", capped.slice().sort(), options?.autoEnrich],
    queryFn: () => getCompaniesBatchDetails(capped, options),
    enabled: capped.length > 0,
  });
  return { ...query, isTruncated, totalRequested: orgnrs.length };
}

export function useCreateListFromQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createListFromUniverseFilters>[0]) =>
      createListFromUniverseFilters(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app", "lists"] });
    },
  });
}

export function useProspects() {
  return useQuery({
    queryKey: ["app", "prospects"],
    queryFn: () => getProspects({ scope: "team" }),
  });
}

export function usePromptTemplates() {
  return useQuery({
    queryKey: ["app", "promptTemplates"],
    queryFn: getAnalysisTemplates,
  });
}

export function usePromptTemplate(templateId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "promptTemplates", templateId ?? ""],
    queryFn: () => getAnalysisTemplate(templateId!),
    enabled: !!templateId && enabled,
  });
}

export function useAIRuns() {
  return useQuery({
    queryKey: ["app", "aiRuns"],
    queryFn: getAnalysisRuns,
  });
}

export function useAIRun(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "aiRuns", runId ?? ""],
    queryFn: () => getAnalysisRun(runId!),
    enabled: !!runId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "running" || data?.status === "queued" ? 2000 : false;
    },
  });
}

export function useCreateAIRun(
  mutationOptions?: UseMutationOptions<Awaited<ReturnType<typeof createAnalysisRun>>, Error, CreateAnalysisRunDTO>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAnalysisRun,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: ["app", "aiRuns"] });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export function useCancelAIRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => cancelAnalysisRun(runId),
    onSuccess: (_, runId) => {
      qc.invalidateQueries({ queryKey: ["app", "aiRuns", runId] });
      qc.invalidateQueries({ queryKey: ["app", "aiRuns"] });
    },
  });
}

export function useRunResults(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "aiRuns", runId ?? "", "results"],
    queryFn: () => getAnalysisRunResults(runId!),
    enabled: !!runId && enabled,
  });
}

export function useCompanyAIProfile(orgnr: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "aiProfiles", orgnr ?? ""],
    queryFn: () => getCompanyAnalysisProfile(orgnr!),
    enabled: !!orgnr && enabled,
    retry: false,
  });
}

export function useCompanyFinancials(orgnr: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app", "companies", orgnr ?? "", "financials"],
    queryFn: () => getCompanyFinancialHistory(orgnr!),
    enabled: !!orgnr && enabled,
  });
}
