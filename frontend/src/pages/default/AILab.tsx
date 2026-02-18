import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  usePromptTemplates,
  useLists,
} from "@/lib/hooks/apiQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TemplateDialog } from "@/components/default/TemplateDialog";
import { EmptyState } from "@/components/default/EmptyState";
import { ErrorState } from "@/components/default/ErrorState";
import {
  ChevronDown,
  FileText,
  Copy,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { PromptTemplate } from "@/lib/api/types";
import {
  createAnalysisTemplate,
  updateAnalysisTemplate,
  duplicateAnalysisTemplate,
} from "@/lib/api/analysis/service";

export default function AILab() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError, error: templatesErrorObj, refetch: refetchTemplates } = usePromptTemplates();
  const { data: lists = [] } = useLists();

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | undefined>(undefined);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  const toggleTemplateExpansion = (templateId: string) => {
    setExpandedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  };

  const handleTemplateEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleTemplateDuplicate = async (template: PromptTemplate) => {
    try {
      await duplicateAnalysisTemplate(template.id);
      refetchTemplates();
      toast.success("Template duplicated successfully!");
    } catch {
      toast.error("Template management not yet implemented in backend");
    }
  };

  const handleTemplateCreate = () => {
    setEditingTemplate(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleTemplateSave = async (
    template: Omit<PromptTemplate, "id" | "created_at" | "created_by">
  ) => {
    try {
      if (dialogMode === "create") {
        await createAnalysisTemplate(template);
        refetchTemplates();
        toast.success("Template created successfully!");
      } else if (editingTemplate) {
        await updateAnalysisTemplate(editingTemplate.id, template);
        refetchTemplates();
        toast.success("Template updated successfully!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Template management not yet implemented in backend");
    }
  };

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-foreground mb-2">AI Lab</h1>
          <p className="text-sm text-muted-foreground">
            Analyze companies using AI-powered prompt templates
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-base font-medium text-foreground mb-1">
              Create New Run
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedTemplate ? (
                <>
                  Pick a list from Universe or My Lists. You&apos;ll name the run, review the cost estimate, and start the analysis on the next page.
                </>
              ) : (
                <>
                  <strong>Step 1:</strong> Choose a prompt template below. Each template defines scoring dimensions (e.g. Market Position, Growth) and analysis instructions.<br />
                  <strong>Step 2:</strong> Select a list or open a company to run on a single company.
                </>
              )}
            </p>
            {selectedTemplate ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Select List to Analyze
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    onChange={(e) => {
                      if (e.target.value) {
                        navigate(
                          `/ai/run/create?template=${selectedTemplate}&list=${e.target.value}`
                        );
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a list...
                    </option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.companyIds.length} companies)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cost and time estimates appear on the next page before you start. You can also run analysis on a single company from its detail page.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Expand a template card below to see scoring dimensions, then click Select to continue.
              </p>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-foreground">Recent Runs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  View and manage your AI analysis runs
                </p>
              </div>
              <Link to="/ai/runs">
                <Button variant="outline" size="sm" className="h-8">
                  View all runs
                </Button>
              </Link>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium text-foreground">
                Prompt Templates
              </h2>
              <span className="text-xs text-muted-foreground">
                {templates.length} templates
              </span>
            </div>

            {templatesError ? (
              <ErrorState
                message={templatesErrorObj?.message ?? "Failed to load templates"}
                retry={() => refetchTemplates()}
              />
            ) : templatesLoading && templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Loading templates...</p>
            ) : templates.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-6">
                <EmptyState
                  title="No templates yet"
                  description="Create a template or wait for backend implementation"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleTemplateCreate}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create New Template
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Collapsible
                    key={template.id}
                    open={expandedTemplates.has(template.id)}
                    onOpenChange={() => toggleTemplateExpansion(template.id)}
                  >
                    <div
                      className={`bg-card rounded-lg border transition-all ${
                        selectedTemplate === template.id
                          ? "border-primary shadow-sm"
                          : "border-border"
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <CollapsibleTrigger className="flex items-start gap-3 flex-1 text-left">
                            <div className="mt-0.5">
                              <ChevronDown
                                className={`w-4 h-4 text-muted-foreground transition-transform ${
                                  expandedTemplates.has(template.id)
                                    ? "transform rotate-180"
                                    : ""
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-foreground mb-1">
                                {template.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                            </div>
                          </CollapsibleTrigger>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTemplate(template.id);
                              }}
                              className="h-8"
                            >
                              {selectedTemplate === template.id
                                ? "Selected"
                                : "Select"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTemplateEdit(template);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTemplateDuplicate(template);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border">
                          <div className="pt-3">
                            <div className="mb-3">
                              <p className="text-xs font-medium text-foreground mb-2">
                                Scoring Dimensions
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {template.scoringDimensions.map((dim) => (
                                  <span
                                    key={dim.id}
                                    className="text-xs px-2 py-1 bg-muted text-foreground rounded"
                                  >
                                    {dim.name} ({(dim.weight * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-foreground mb-2">
                                Data Fields
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {template.variables.map((variable) => (
                                  <span
                                    key={variable}
                                    className="text-xs px-2 py-0.5 bg-muted/40 text-muted-foreground rounded font-mono border border-border"
                                  >
                                    {variable}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTemplateEdit(template);
                              }}
                              className="mt-3 h-8"
                            >
                              <FileText className="w-3 h-3 mr-1.5" />
                              View Full Prompt
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTemplateCreate}
                  className="w-full h-9"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create New Template
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        template={editingTemplate}
        mode={dialogMode}
        onSave={handleTemplateSave}
      />
    </div>
  );
}
