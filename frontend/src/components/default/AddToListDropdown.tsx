import { useState, useRef } from "react";
import { useLists, useAddToList } from "@/lib/hooks/apiQueries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ListPlus } from "lucide-react";

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
  const submittingRef = useRef(false);
  const { data: lists = [], isLoading } = useLists();
  const addMutation = useAddToList();

  const isDisabled = disabled || isLoading || lists.length === 0 || addMutation.isPending;

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

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
