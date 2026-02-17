import { useState } from "react";
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

interface SaveListDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, isPublic: boolean) => void;
  companyCount?: number;
  /** Override default description e.g. for "Save view as list" */
  description?: string;
  /** Disable submit while mutation in progress */
  isLoading?: boolean;
}

export function SaveListDialog({ open, onClose, onSave, companyCount = 0, description, isLoading }: SaveListDialogProps) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "public">("private");

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), privacy === "public");
      setName("");
      setPrivacy("private");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as List</DialogTitle>
          <DialogDescription>
            {description ?? `Create a new list with ${companyCount} selected ${companyCount === 1 ? "company" : "companies"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="bg-primary/10 border border-primary/40 rounded p-3 text-sm text-primary">
            ✓ Filters will be saved with this list so you can reload and modify them later
          </div>
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
