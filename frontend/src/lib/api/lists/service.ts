import {
  addListItemsClient,
  createListClient,
  createListFromQueryClient,
  deleteListClient,
  getListItemsClient,
  getListsClient,
  removeListItemClient,
  type SavedListRecord,
  type CreateFromQueryPayload,
  updateListClient,
} from "@/lib/api/lists/client";
import type { CreateListDTO, Filters, List } from "@/lib/api/types";
import { createView, getViews, updateView } from "@/lib/services/viewsService";

function mapSavedListToListModel(saved: SavedListRecord, companyIds: string[], filters?: Filters): List {
  return {
    id: saved.id,
    name: saved.name,
    owner_user_id: saved.owner_user_id,
    scope: saved.scope,
    source_view_id: saved.source_view_id ?? undefined,
    filters,
    companyIds,
    stage: "research",
    created_at: saved.created_at,
    updated_at: saved.updated_at,
    created_by: saved.owner_user_id,
    created_by_name: saved.owner_email,
    updated_by: saved.owner_user_id,
  };
}

async function loadFiltersByViewId(): Promise<Map<string, Filters>> {
  try {
    const views = await getViews("all");
    const map = new Map<string, Filters>();
    for (const v of views.items ?? []) {
      if (v.id && v.filtersJson) {
        map.set(v.id, v.filtersJson as Filters);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getAllLists(): Promise<List[]> {
  const raw = await getListsClient("all");
  const filterMap = await loadFiltersByViewId();

  const lists = await Promise.all(
    (raw.items ?? []).map(async (saved) => {
      try {
        const itemsRes = await getListItemsClient(saved.id);
        const companyIds = itemsRes.items.map((i) => i.orgnr);
        const filters = saved.source_view_id ? filterMap.get(saved.source_view_id) : undefined;
        return mapSavedListToListModel(saved, companyIds, filters);
      } catch {
        const filters = saved.source_view_id ? filterMap.get(saved.source_view_id) : undefined;
        return mapSavedListToListModel(saved, [], filters);
      }
    })
  );

  return lists;
}

export async function getListById(listId: string): Promise<List | null> {
  const lists = await getAllLists();
  return lists.find((l) => l.id === listId) ?? null;
}

export async function createListEntry(data: CreateListDTO): Promise<List> {
  let sourceViewId: string | undefined;

  if (data.filters) {
    const view = await createView({
      name: `${data.name} Filters`,
      scope: data.scope ?? "private",
      filtersJson: data.filters as unknown as Record<string, unknown>,
      columnsJson: [],
      sortJson: {},
    });
    sourceViewId = view.id;
  }

  const saved = await createListClient({
    name: data.name,
    scope: data.scope ?? "private",
    sourceViewId,
  });

  if (data.companyIds?.length) {
    await addListItemsClient(saved.id, data.companyIds);
  }

  const list = await getListById(saved.id);
  if (!list) {
    return mapSavedListToListModel(saved, data.companyIds ?? [], data.filters);
  }
  return list;
}

export async function updateListEntry(listId: string, data: Partial<List>): Promise<List> {
  const current = await getListById(listId);
  if (!current) throw new Error("List not found");

  let sourceViewId = current.source_view_id;

  if (data.filters !== undefined) {
    if (sourceViewId) {
      await updateView(sourceViewId, {
        filtersJson: data.filters as unknown as Record<string, unknown>,
      });
    } else {
      const view = await createView({
        name: `${data.name ?? current.name} Filters`,
        scope: (data.scope ?? current.scope) as "private" | "team",
        filtersJson: data.filters as unknown as Record<string, unknown>,
        columnsJson: [],
        sortJson: {},
      });
      sourceViewId = view.id;
    }
  }

  const shouldUpdateList =
    data.name !== undefined ||
    data.scope !== undefined ||
    sourceViewId !== current.source_view_id;

  if (shouldUpdateList) {
    await updateListClient(listId, {
      name: data.name,
      scope: data.scope,
      sourceViewId: sourceViewId ?? null,
    });
  }

  const refreshed = await getListById(listId);
  if (!refreshed) throw new Error("List not found after update");
  return refreshed;
}

export async function deleteListEntry(listId: string): Promise<void> {
  await deleteListClient(listId);
}

export async function addCompaniesToList(listId: string, orgnrs: string[]) {
  return addListItemsClient(listId, orgnrs);
}

export async function removeCompanyFromList(listId: string, orgnr: string): Promise<void> {
  await removeListItemClient(listId, orgnr);
}

export async function createListFromUniverseFilters(payload: CreateFromQueryPayload) {
  return createListFromQueryClient(payload);
}
