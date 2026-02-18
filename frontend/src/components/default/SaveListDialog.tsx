import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type SaveListType = "selection" | "view";

interface SaveListDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with (name, isPublic, saveType). Parent handles selection vs view. */
  onSave: (name: string, isPublic: boolean, saveType: SaveListType) => void;
  /** Number of companies currently selected. If > 0, user can choose "selection" or "view". */
  selectedCount?: number;
  /** Disable submit while mutation in progress */
  isLoading?: boolean;
}

export function SaveListDialog({
  open,
  onClose,
  onSave,
  selectedCount = 0,
  isLoading,
}: SaveListDialogProps) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "public">("private");
  const [saveType, setSaveType] = useState<SaveListType>(selectedCount > 0 ? "selection" : "view");

  useEffect(() => {
    if (open) {
      setSaveType(selectedCount > 0 ? "selection" : "view");
    }
  }, [open, selectedCount]);

  const canChooseSelection = selectedCount > 0;
  const effectiveType = canChooseSelection ? saveType : "view";

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), privacy === "public", effectiveType);
      setName("");
      setPrivacy("private");
      setSaveType(selectedCount > 0 ? "selection" : "view");
    }
  };

  const description =
    effectiveType === "selection"
      ? `Create a new list with ${selectedCount} selected ${selectedCount === 1 ? "company" : "companies"}.`
      : "Create a list from all companies matching your current filters, search, and sort.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as List</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {canChooseSelection && (
            <div className="space-y-2">
              <Label>What to save</Label>
              <RadioGroup
                value={saveType}
                onValueChange={(v) => setSaveType(v as SaveListType)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selection" id="save-selection" />
                  <Label htmlFor="save-selection" className="font-normal cursor-pointer">
                    Selected companies ({selectedCount})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="view" id="save-view" />
                  <Label htmlFor="save-view" className="font-normal cursor-pointer">
                    Current view (all matching filters)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="list-name">List Name</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Manufacturing Targets"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Privacy</Label>
            <RadioGroup value={privacy} onValueChange={(value) => setPrivacy(value as "private" | "public")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="font-normal cursor-pointer">
                  Private (only you can see this list)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="font-normal cursor-pointer">
                  Shareable (team members can view)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {effectiveType === "view" && (
            <div className="bg-muted border border-border rounded p-3 text-sm text-muted-foreground">
              ✓ Filters will be saved with this list so you can reload and modify them later
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>
            {isLoading ? "Creating…" : "Create List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
