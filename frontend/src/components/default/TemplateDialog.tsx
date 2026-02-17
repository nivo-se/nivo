import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import type { PromptTemplate } from "@/types/figma";

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: Omit<PromptTemplate, "id" | "created_at" | "created_by">) => void;
  template?: PromptTemplate;
  mode: "create" | "edit";
}

export function TemplateDialog({
  open,
  onClose,
  onSave,
  template,
  mode,
}: TemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [newVariable, setNewVariable] = useState("");
  const [scoringDimensions, setScoringDimensions] = useState<
    PromptTemplate["scoringDimensions"]
  >([]);
  const [newDimension, setNewDimension] = useState({
    name: "",
    description: "",
    weight: "",
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setPrompt(template.prompt);
      setVariables([...template.variables]);
      setScoringDimensions([...template.scoringDimensions]);
    } else {
      setName("");
      setDescription("");
      setPrompt("");
      setVariables([]);
      setScoringDimensions([]);
    }
  }, [template, open]);

  const handleAddVariable = () => {
    if (newVariable && !variables.includes(newVariable)) {
      setVariables([...variables, newVariable]);
      setNewVariable("");
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setVariables(variables.filter((v) => v !== variable));
  };

  const handleAddDimension = () => {
    if (newDimension.name && newDimension.description && newDimension.weight) {
      const weight = parseFloat(newDimension.weight);
      if (weight > 0 && weight <= 1) {
        setScoringDimensions([
          ...scoringDimensions,
          {
            id: newDimension.name.toLowerCase().replace(/\s+/g, "_"),
            name: newDimension.name,
            description: newDimension.description,
            weight,
          },
        ]);
        setNewDimension({ name: "", description: "", weight: "" });
      }
    }
  };

  const handleRemoveDimension = (id: string) => {
    setScoringDimensions(scoringDimensions.filter((d) => d.id !== id));
  };

  const handleSave = () => {
    const totalWeight = scoringDimensions.reduce((sum, d) => sum + d.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      alert("Scoring dimension weights must sum to 1.0 (100%)");
      return;
    }
    onSave({ name, description, prompt, variables, scoringDimensions });
    onClose();
  };

  const totalWeight = scoringDimensions.reduce((sum, d) => sum + d.weight, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update your prompt template settings and configuration"
              : "Create a new AI analysis prompt template"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acquisition Fit - Standard"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template's purpose"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt Template</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt template. Use {{variable_name}} for dynamic fields."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use double curly braces for variables: {`{{company_name}}, {{revenue_latest}}, etc.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Data Variables</Label>
            <div className="flex gap-2">
              <Input
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                placeholder="e.g., company_name"
                onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
              />
              <Button
                type="button"
                onClick={handleAddVariable}
                size="sm"
                variant="outline"
                className="hover:bg-muted hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {variables.map((variable) => (
                <Badge key={variable} variant="secondary" className="text-xs">
                  {variable}
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(variable)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scoring Dimensions</Label>
            <div className="grid grid-cols-12 gap-2">
              <Input
                placeholder="Name"
                value={newDimension.name}
                onChange={(e) =>
                  setNewDimension({ ...newDimension, name: e.target.value })
                }
                className="col-span-4"
              />
              <Input
                placeholder="Description"
                value={newDimension.description}
                onChange={(e) =>
                  setNewDimension({ ...newDimension, description: e.target.value })
                }
                className="col-span-5"
              />
              <Input
                placeholder="0.25"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={newDimension.weight}
                onChange={(e) =>
                  setNewDimension({ ...newDimension, weight: e.target.value })
                }
                className="col-span-2"
              />
              <Button
                type="button"
                onClick={handleAddDimension}
                size="sm"
                variant="outline"
                className="col-span-1 hover:bg-muted hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {scoringDimensions.length > 0 && (
              <div className="mt-3 space-y-2">
                {scoringDimensions.map((dim) => (
                  <div
                    key={dim.id}
                    className="flex items-center justify-between p-2 bg-muted/40 rounded border"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{dim.name}</div>
                      <div className="text-xs text-muted-foreground">{dim.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {(dim.weight * 100).toFixed(0)}%
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleRemoveDimension(dim.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center text-sm pt-2 border-t">
                  <span className="font-medium">Total Weight:</span>
                  <span
                    className={
                      totalWeight === 1.0
                        ? "text-primary font-medium"
                        : "text-destructive font-medium"
                    }
                  >
                    {(totalWeight * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="hover:bg-muted hover:text-foreground">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={
              !name ||
              !description ||
              !prompt ||
              variables.length === 0 ||
              scoringDimensions.length === 0 ||
              Math.abs(totalWeight - 1.0) > 0.01
            }
            className="hover:bg-muted hover:text-foreground"
          >
            {mode === "edit" ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
