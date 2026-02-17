import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  usePromptTemplates,
  useAIRuns,
  useLists,
} from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TemplateDialog } from "@/components/new/TemplateDialog";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  FileText,
  Copy,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { PromptTemplate } from "@/types/figma";
import {
  createPromptTemplate,
  updatePromptTemplate,
  duplicatePromptTemplate,
} from "@/lib/services/figmaApi";

export default function NewAILab() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError, error: templatesErrorObj, refetch: refetchTemplates } = usePromptTemplates();
  const { data: runs = [], isLoading: runsLoading, isError: runsError, error: runsErrorObj, refetch: refetchRuns } = useAIRuns();
  const { data: lists = [] } = useLists();

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | undefined>(undefined);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  const recentRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "running":
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case "queued":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

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
      await duplicatePromptTemplate(template.id);
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
        await createPromptTemplate(template);
        refetchTemplates();
        toast.success("Template created successfully!");
      } else if (editingTemplate) {
        await updatePromptTemplate(editingTemplate.id, template);
        refetchTemplates();
        toast.success("Template updated successfully!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Template management not yet implemented in backend");
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">AI Lab</h1>
          <p className="text-sm text-gray-600">
            Analyze companies using AI-powered prompt templates
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-base font-medium text-gray-900 mb-1">
              Create New Run
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedTemplate
                ? "Select a list to analyze with the chosen template"
                : "Select a template below to get started"}
            </p>
            {selectedTemplate ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Select List to Analyze
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <p className="text-xs text-gray-500">
                  Estimated cost: ~$0.20 per company
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Select a template below to continue
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">Recent Runs</h2>
              <span className="text-xs text-gray-500">{recentRuns.length} runs</span>
            </div>
            {runsError ? (
              <ErrorState
                message={runsErrorObj?.message ?? "Failed to load runs"}
                retry={() => refetchRuns()}
              />
            ) : recentRuns.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No analysis runs yet. Create your first run to get started.</p>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => {
                  const template = templates.find((t) => t.id === run.template_id);
                  return (
                    <div
                      key={run.id}
                      className="p-5 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-gray-900">{run.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {run.status === "running" ? "Running" : run.status === "completed" ? "Completed" : run.status === "failed" ? "Failed" : run.status === "queued" ? "Queued" : run.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {template?.name ?? "Template"} • {run.total_companies} companies • {new Date(run.created_at).toLocaleString()}
                      </div>
                      {(run.status === "running" || run.status === "queued") && (
                        <div className="mb-3">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${run.total_companies > 0 ? (run.processed_companies / run.total_companies) * 100 : 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{run.processed_companies} of {run.total_companies} analyzed</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {(run.status === "completed" || run.processed_companies > 0) && (
                          <Link to={`/ai/runs/${run.id}/results`}>
                            <Button variant="outline" size="sm" className="h-8 text-sm">
                              View Results
                            </Button>
                          </Link>
                        )}
                        <Link to={`/ai/runs/${run.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium text-gray-900">
                Prompt Templates
              </h2>
              <span className="text-xs text-gray-500">
                {templates.length} templates
              </span>
            </div>

            {templatesError ? (
              <ErrorState
                message={templatesErrorObj?.message ?? "Failed to load templates"}
                retry={() => refetchTemplates()}
              />
            ) : templatesLoading && templates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Loading templates...</p>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                      className={`bg-white rounded-lg border transition-all ${
                        selectedTemplate === template.id
                          ? "border-blue-500 shadow-sm"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <CollapsibleTrigger className="flex items-start gap-3 flex-1 text-left">
                            <div className="mt-0.5">
                              <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  expandedTemplates.has(template.id)
                                    ? "transform rotate-180"
                                    : ""
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 mb-1">
                                {template.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {template.description}
                              </p>
                            </div>
                          </CollapsibleTrigger>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={
                                selectedTemplate === template.id
                                  ? "default"
                                  : "outline"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTemplate(template.id);
                              }}
                              className="text-xs h-8"
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
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
                          <div className="pt-3">
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">
                                Scoring Dimensions
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {template.scoringDimensions.map((dim) => (
                                  <span
                                    key={dim.id}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                                  >
                                    {dim.name} ({(dim.weight * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-2">
                                Data Fields
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {template.variables.map((variable) => (
                                  <span
                                    key={variable}
                                    className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded font-mono border border-gray-200"
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
                              className="mt-3 text-xs h-8"
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
                  className="w-full text-sm h-9"
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
