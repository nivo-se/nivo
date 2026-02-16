import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { LibrarySidebar } from "@/components/library";
import {
  useListItems,
  useRemoveListItem,
  useDeleteList,
} from "@/components/library/useLists";
import { getLabels, addLabel, removeLabel } from "@/lib/services/labelsService";
import type { SavedList } from "@/lib/services/listsService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PipelinePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listFromUrl = searchParams.get("list");
  const [selectedListId, setSelectedListId] = useState<string | null>(listFromUrl || null);
  const [selectedOrgnrs, setSelectedOrgnrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (listFromUrl) {
      setSelectedListId(listFromUrl);
    }
  }, [listFromUrl]);
  const [addLabelOrgnr, setAddLabelOrgnr] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);

  const itemsQ = useListItems(selectedListId);
  const removeItem = useRemoveListItem();
  const deleteList = useDeleteList();

  const items = itemsQ.data?.items ?? [];

  const toggleSelect = (orgnr: string) => {
    setSelectedOrgnrs((prev) => {
      const next = new Set(prev);
      if (next.has(orgnr)) next.delete(orgnr);
      else next.add(orgnr);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrgnrs.size === items.length) {
      setSelectedOrgnrs(new Set());
    } else {
      setSelectedOrgnrs(new Set(items.map((i) => i.orgnr)));
    }
  };

  const handleRemoveSelected = async () => {
    if (!selectedListId) return;
    for (const orgnr of selectedOrgnrs) {
      await removeItem.mutateAsync({ listId: selectedListId, orgnr });
    }
    setSelectedOrgnrs(new Set());
    setRemoveConfirm(false);
  };

  const handleSelectList = (list: SavedList) => {
    setSelectedListId(list.id);
    setSelectedOrgnrs(new Set());
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      <aside className="w-64 shrink-0">
        <LibrarySidebar
          mode="lists"
          selectedId={selectedListId}
          onSelectList={handleSelectList}
        />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-4 p-6 overflow-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Work with saved lists: add companies, apply labels, run enrichment.
            </p>
          </div>

          {selectedListId && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedOrgnrs.size === 0}
                onClick={() => setRemoveConfirm(true)}
              >
                Remove selected ({selectedOrgnrs.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/app/universe")}>
                Add companies…
              </Button>
            </div>
          )}
        </div>

        {!selectedListId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a list from the sidebar or create a new one from Universe.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Card className="xl:col-span-8">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  List items <span className="text-muted-foreground">({items.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={items.length > 0 && selectedOrgnrs.size === items.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Org nr</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow
                          key={item.orgnr}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/app/companies/${item.orgnr}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrgnrs.has(item.orgnr)}
                              onCheckedChange={() => toggleSelect(item.orgnr)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.orgnr}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.added_at?.slice(0, 10)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAddLabelOrgnr(item.orgnr)}
                            >
                              + Label
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {itemsQ.isLoading && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Loading…
                          </TableCell>
                        </TableRow>
                      )}
                      {!itemsQ.isLoading && items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            No companies in this list.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle className="text-sm">List stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Companies</span>
                  <span className="font-medium">{items.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={removeConfirm} onOpenChange={setRemoveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from list</DialogTitle>
            <DialogDescription>
              Remove {selectedOrgnrs.size} selected companies from this list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveSelected}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addLabelOrgnr} onOpenChange={() => setAddLabelOrgnr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add label</DialogTitle>
            <DialogDescription>Add a label for {addLabelOrgnr} (e.g. Hot, Pass)</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Label (e.g. Hot, Pass)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLabelOrgnr(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (addLabelOrgnr && newLabel.trim()) {
                  try {
                    await addLabel(addLabelOrgnr, { label: newLabel.trim(), scope: "team" });
                    setAddLabelOrgnr(null);
                    setNewLabel("");
                  } catch (e) {
                    console.error(e);
                  }
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
