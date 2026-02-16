import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileUp, RefreshCw, Sparkles, MoreHorizontal } from "lucide-react";
import type { SavedView } from "@/lib/services/viewsService";

type Props = {
  q: string;
  onQChange: (v: string) => void;
  onRefresh: () => void;
  onEnrich?: () => void;
  saveViewOpen: boolean;
  setSaveViewOpen: (open: boolean) => void;
  saveViewName: string;
  setSaveViewName: (v: string) => void;
  onSaveView: () => void;
  createListOpen: boolean;
  setCreateListOpen: (open: boolean) => void;
  createListName: string;
  setCreateListName: (v: string) => void;
  createListScope: "current" | "all";
  setCreateListScope: (v: "current" | "all") => void;
  createListLoading: boolean;
  onCreateList: () => void;
  selectedViewId: string | null;
  isModified: boolean;
  rowsCount: number;
  totalCount: number;
  allViews: SavedView[];
  onSelectView: (view: SavedView) => void;
  onClearAll: () => void;
  onReset: () => void;
  hasFilters: boolean;
  presets?: { id: string; label: string }[];
  selectedPresetId?: string | null;
  onApplyPreset?: (id: string) => void;
};

export function QueryBar({
  q,
  onQChange,
  onRefresh,
  onEnrich,
  saveViewOpen,
  setSaveViewOpen,
  saveViewName,
  setSaveViewName,
  onSaveView,
  createListOpen,
  setCreateListOpen,
  createListName,
  setCreateListName,
  createListScope,
  setCreateListScope,
  createListLoading,
  onCreateList,
  selectedViewId,
  isModified,
  rowsCount,
  totalCount,
  allViews,
  onSelectView,
  onClearAll,
  onReset,
  hasFilters,
  presets,
  selectedPresetId,
  onApplyPreset,
}: Props) {
  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        placeholder="Search company name or orgnr…"
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        className="h-9 max-w-[720px] flex-1 min-w-[200px]"
      />
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="gap-1 rounded-full h-7 px-2.5 text-[11px]">
              <FileDown className="h-3.5 w-3.5" />
              Load View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {allViews.length === 0 && (
              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                No saved views
              </DropdownMenuItem>
            )}
            {allViews.map((view) => (
              <DropdownMenuItem key={view.id} onClick={() => onSelectView(view)}>
                {view.name}
                {selectedViewId === view.id && " ✓"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
          <div className="flex items-center gap-1.5">
            <DialogTrigger asChild>
              <Button variant="default" size="xs" className="gap-1 rounded-full h-7 px-2.5 text-[11px]">
                <FileUp className="h-3.5 w-3.5" />
                {selectedViewId && isModified ? "Save" : "Save View"}
              </Button>
            </DialogTrigger>
            {isModified && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Modified</Badge>
            )}
          </div>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedViewId ? "Save changes" : "Save View"}</DialogTitle>
              <DialogDescription>Save current filters and sort as a reusable view.</DialogDescription>
            </DialogHeader>
            <Input placeholder="View name" value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" size="xs" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
              <Button size="xs" onClick={onSaveView}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="xs" className="rounded-full h-7 px-2.5 text-[11px]">
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Snapshot List</DialogTitle>
              <DialogDescription>Create a static list from the current Universe query.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Include</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createListScope"
                      checked={createListScope === "current"}
                      onChange={() => setCreateListScope("current")}
                      className="rounded-full"
                    />
                    <span className="text-sm">Current page only ({rowsCount} companies)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createListScope"
                      checked={createListScope === "all"}
                      onChange={() => setCreateListScope("all")}
                      className="rounded-full"
                    />
                    <span className="text-sm">All matching ({totalCount.toLocaleString()} companies)</span>
                  </label>
                </div>
              </div>
              <Input
                placeholder="List name"
                value={createListName}
                onChange={(e) => setCreateListName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="xs" onClick={() => setCreateListOpen(false)} disabled={createListLoading}>
                Cancel
              </Button>
              <Button size="xs" onClick={onCreateList} disabled={createListLoading}>
                {createListLoading ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="xs" onClick={onRefresh} className="rounded-full h-7 px-2.5 text-[11px]">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        {onEnrich && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnrich}
            className="h-7 w-7 rounded-full"
            title="Run enrichment"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasFilters && (
              <DropdownMenuItem onClick={onClearAll}>Clear filters</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onReset}>Reset all</DropdownMenuItem>
            {presets && presets.length > 0 && onApplyPreset && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px]">Presets</DropdownMenuLabel>
                {presets.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => onApplyPreset(p.id)}>
                    {p.label}
                    {selectedPresetId === p.id && " ✓"}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
