import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Search, FileText, List, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViews, useCreateView, useUpdateView, useDeleteView } from "./useViews";
import { useLists, useCreateList, useDeleteList } from "./useLists";
import type { SavedView } from "@/lib/services/viewsService";
import type { SavedList } from "@/lib/services/listsService";

export type LibraryMode = "views" | "lists";

export interface LibrarySidebarProps {
  mode: LibraryMode;
  layout?: "tabs" | "universe";
  selectedId?: string | null;
  onSelectView?: (view: SavedView) => void;
  onSelectList?: (list: SavedList) => void;
  onNewView?: () => void;
  onNewList?: () => void;
  onModeChange?: (mode: LibraryMode) => void;
  className?: string;
}

export function LibrarySidebar({
  mode,
  layout = "tabs",
  selectedId,
  onSelectView,
  onSelectList,
  onNewView,
  onNewList,
  onModeChange,
  className,
}: LibrarySidebarProps) {
  const [search, setSearch] = useState("");
  const [listsOpen, setListsOpen] = useState(true);
  const qc = useQueryClient();

  const viewsQ = useViews("all");
  const listsQ = useLists("all");
  const createView = useCreateView();
  const createList = useCreateList();
  const deleteView = useDeleteView();
  const deleteList = useDeleteList();

  const views = viewsQ.data?.items ?? [];
  const lists = listsQ.data?.items ?? [];

  const filterItems = <T,>(items: T[], getName: (x: T) => string) =>
    search.trim()
      ? items.filter((x) => getName(x).toLowerCase().includes(search.toLowerCase()))
      : items;

  const myViews = filterItems(views.filter((v) => v.scope === "private"), (v) => v.name);
  const teamViews = filterItems(views.filter((v) => v.scope === "team"), (v) => v.name);
  const myLists = filterItems(lists.filter((l) => l.scope === "private"), (l) => l.name);
  const teamLists = filterItems(lists.filter((l) => l.scope === "team"), (l) => l.name);

  const handleCreateView = async () => {
    if (onNewView) {
      onNewView();
      return;
    }
    try {
      const v = await createView.mutateAsync({
        name: "New View",
        scope: "private",
      });
      qc.invalidateQueries({ queryKey: ["views"] });
      onSelectView?.(v);
    } catch {
      // toast error
    }
  };

  const handleCreateList = async () => {
    if (onNewList) {
      onNewList();
      return;
    }
    try {
      const l = await createList.mutateAsync({
        name: "New List",
        scope: "private",
      });
      qc.invalidateQueries({ queryKey: ["lists"] });
      onSelectList?.(l);
    } catch {
      // toast error
    }
  };

  if (layout === "universe") {
    return (
        <div className={cn("flex flex-col border-r bg-muted/30 min-h-0 min-w-0 overflow-hidden", className)}>
          <div className="p-3 border-b shrink-0">
            <div className="text-sm font-medium">Saved Views</div>
          </div>
          <div className="p-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="px-3 pb-2 shrink-0">
            <Button size="sm" variant="outline" className="w-full" onClick={handleCreateView}>
              <Plus className="h-4 w-4 mr-1" />
              New View
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-4">
              <Section title="My Views" items={myViews} selectedId={selectedId} onSelect={onSelectView} onDelete={(id) => deleteView.mutate(id)} />
              <Section title="Team Views" items={teamViews} selectedId={selectedId} onSelect={onSelectView} onDelete={(id) => deleteView.mutate(id)} />
            </div>
            <Collapsible open={listsOpen} onOpenChange={setListsOpen} className="px-2 pb-4">
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                {listsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <List className="h-4 w-4" />
                Lists
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1 space-y-4">
                <Section title="My Lists" items={myLists} selectedId={selectedId} onSelect={onSelectList} onDelete={(id) => deleteList.mutate(id)} />
                <Section title="Team Lists" items={teamLists} selectedId={selectedId} onSelect={onSelectList} onDelete={(id) => deleteList.mutate(id)} />
              </CollapsibleContent>
            </Collapsible>
          </ScrollArea>
        </div>
      );
  }

  return (
    <div className={cn("flex flex-col border-r bg-muted/30", className)}>
      <Tabs value={mode} onValueChange={(v) => onModeChange?.(v as LibraryMode)} className="flex-1 flex flex-col min-h-0">
        <div className="p-3 border-b">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="views" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Views
            </TabsTrigger>
            <TabsTrigger value="lists" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lists
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 pb-2">
          {mode === "views" ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleCreateView}>
              <Plus className="h-4 w-4 mr-1" />
              New View
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleCreateList}>
              <Plus className="h-4 w-4 mr-1" />
              New List
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <TabsContent value="views" className="mt-0 p-2 space-y-4">
            <Section title="My Views" items={myViews} selectedId={selectedId} onSelect={onSelectView} onDelete={(id) => deleteView.mutate(id)} />
            <Section title="Team Views" items={teamViews} selectedId={selectedId} onSelect={onSelectView} onDelete={(id) => deleteView.mutate(id)} />
          </TabsContent>
          <TabsContent value="lists" className="mt-0 p-2 space-y-4">
            <Section title="My Lists" items={myLists} selectedId={selectedId} onSelect={onSelectList} onDelete={(id) => deleteList.mutate(id)} />
            <Section title="Team Lists" items={teamLists} selectedId={selectedId} onSelect={onSelectList} onDelete={(id) => deleteList.mutate(id)} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function Section<T extends { id: string; name: string; item_count?: number }>({
  title,
  items,
  selectedId,
  onSelect,
  onDelete,
}: {
  title: string;
  items: T[];
  selectedId?: string | null;
  onSelect?: (item: T) => void;
  onDelete?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">{title}</div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
              selectedId === item.id && "bg-muted"
            )}
          >
            <button
              type="button"
              className="flex-1 text-left truncate min-w-0 flex items-center gap-1"
              onClick={() => onSelect?.(item)}
            >
              <span className="truncate">{item.name}</span>
              {"item_count" in item && item.item_count != null && (
                <span className="text-xs text-muted-foreground shrink-0">({item.item_count})</span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDelete?.(item.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
