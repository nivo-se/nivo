import { useState, useRef } from "react";
import { useLists, useAddToList, useCreateList } from "@/lib/hooks/apiQueries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ListPlus, Plus } from "lucide-react";

interface AddToListDropdownProps {
  orgnrs: string[];
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddToListDropdown({
  orgnrs,
  disabled = false,
  variant = "outline",
  size = "sm",
  children,
  onSuccess,
}: AddToListDropdownProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const submittingRef = useRef(false);
  const { data: lists = [], isLoading } = useLists();
  const addMutation = useAddToList();
  const createMutation = useCreateList();

  const isDisabled = disabled || isLoading || addMutation.isPending || createMutation.isPending || orgnrs.length === 0;

  const handleAdd = async (listId: string) => {
    if (orgnrs.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    try {
      const res = await addMutation.mutateAsync({ listId, orgnrs });
      setOpen(false);
      toast({
        title: "Added to list",
        description: `Added ${res.added} company${res.added !== 1 ? "ies" : ""} to list.`,
      });
      onSuccess?.();
    } catch (e) {
      toast({
        title: "Failed to add",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const handleCreateNewList = async () => {
    const name = newListName.trim();
    if (!name || orgnrs.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await createMutation.mutateAsync({
        name,
        scope: "private",
        companyIds: orgnrs,
      });
      setCreateOpen(false);
      setNewListName("");
      setOpen(false);
      toast({
        title: "List created",
        description: `Created "${name}" with ${orgnrs.length} company${orgnrs.length !== 1 ? "ies" : ""}.`,
      });
      onSuccess?.();
    } catch (e) {
      toast({
        title: "Failed to create list",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <Button variant={variant} size={size} disabled={isDisabled}>
            <ListPlus className="w-4 h-4 mr-1" />
            Add to list
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {lists.length === 0 ? (
          <DropdownMenuItem disabled>No lists yet</DropdownMenuItem>
        ) : (
          lists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => handleAdd(list.id)}
              disabled={addMutation.isPending}
            >
              {list.name}
              <span className="text-muted-foreground ml-1">({list.companyIds.length})</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            setCreateOpen(true);
          }}
          disabled={createMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create new list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewListName(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new list</DialogTitle>
          <DialogDescription>
            Create a list with {orgnrs.length} selected company{orgnrs.length !== 1 ? "ies" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-list-name">List name</Label>
            <Input
              id="new-list-name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="My list"
              onKeyDown={(e) => e.key === "Enter" && handleCreateNewList()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateNewList}
            disabled={!newListName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
