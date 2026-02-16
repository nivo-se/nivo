import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLists,
  createList,
  addListItems,
  removeListItem,
  deleteList,
  getListItems,
} from "@/lib/services/listsService";

export function useLists(scope: "private" | "team" | "all" = "all") {
  return useQuery({
    queryKey: ["lists", scope],
    queryFn: () => getLists(scope),
    staleTime: 30_000,
  });
}

export function useListItems(listId: string | null) {
  return useQuery({
    queryKey: ["listItems", listId],
    queryFn: () => getListItems(listId!),
    enabled: !!listId,
    staleTime: 15_000,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createList,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useAddListItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnrs }: { listId: string; orgnrs: string[] }) =>
      addListItems(listId, orgnrs),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["listItems", listId] });
    },
  });
}

export function useRemoveListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, orgnr }: { listId: string; orgnr: string }) =>
      removeListItem(listId, orgnr),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["listItems", listId] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["listItems"] });
    },
  });
}
