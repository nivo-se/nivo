import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getViews,
  createView,
  updateView,
  deleteView,
  type SavedView,
} from "@/lib/services/viewsService";

export function useViews(scope: "private" | "team" | "all" = "all") {
  return useQuery({
    queryKey: ["views", scope],
    queryFn: () => getViews(scope),
    staleTime: 30_000,
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createView,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views"] });
    },
  });
}

export function useUpdateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      scope?: "private" | "team";
      filtersJson?: Record<string, unknown>;
      columnsJson?: unknown[];
      sortJson?: Record<string, unknown>;
    }) => updateView(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views"] });
    },
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteView,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views"] });
    },
  });
}
