import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  useLists,
  usePromptTemplates,
  useCreateAIRun,
} from "@/lib/hooks/figmaQueries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Play, DollarSign, ListChecks } from "lucide-react";

export default function NewCreateRun() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = searchParams.get("template");
  const listId = searchParams.get("list");

  const { data: templates = [] } = usePromptTemplates();
  const { data: lists = [] } = useLists();
  const createRunMutation = useCreateAIRun();

  const template = templateId
    ? templates.find((t) => t.id === templateId) ?? templates[0]
    : templates[0];
  const list = listId ? lists.find((l) => l.id === listId) ?? lists[0] : lists[0];

  const [runName, setRunName] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  useEffect(() => {
    if (list && template) {
      setRunName(`${list.name} - ${template.name}`);
    }
  }, [list, template]);

  const estimatedCost = list ? list.companyIds.length * 0.2 : 0;
  const estimatedTime = list
    ? Math.ceil(list.companyIds.length / 10)
    : 0;

  const handleCreateRun = async () => {
    if (!list || !template || !runName.trim()) return;
    try {
      const newRun = await createRunMutation.mutateAsync({
        name: runName.trim(),
        list_id: list.id,
        template_id: template.id,
        config: {
          auto_approve: autoApprove,
          overwrite_existing: overwriteExisting,
        },
      });
      navigate(`/ai/runs/${newRun.id}`);
    } catch (err) {
      console.error("Failed to create run:", err);
    }
  };

  if (!template || !list) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Invalid Configuration
          </h2>
          <p className="text-gray-600 mb-4">
            {lists.length === 0
              ? "Create a list first in Universe or My Lists"
              : "Template or list not found"}
          </p>
          <Link to="/ai">
            <Button>Back to AI Lab</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link to="/ai">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create AI Analysis Run
          </h1>
          <p className="text-gray-600">Configure and launch your analysis</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run Name</CardTitle>
              <CardDescription>
                Give this analysis run a descriptive name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g., Q1 2026 - Manufacturing Batch"
                className="max-w-xl"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Target List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{list.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {list.companyIds.length} companies • Created{" "}
                    {new Date(list.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                  {list.companyIds.length} companies
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-gray-900">{template.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {template.description}
                  </p>
                </div>
                {template.scoringDimensions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Scoring Dimensions:
                    </p>
                    <div className="flex flex-wrap gap-2">
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
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Adjust run settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="auto-approve"
                    checked={autoApprove}
                    onCheckedChange={(c) => setAutoApprove(c === true)}
                  />
                  <div>
                    <label
                      htmlFor="auto-approve"
                      className="text-sm font-medium text-gray-900 cursor-pointer"
                    >
                      Auto-approve results
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically approve all AI results without manual review.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="overwrite"
                    checked={overwriteExisting}
                    onCheckedChange={(c) => setOverwriteExisting(c === true)}
                  />
                  <div>
                    <label
                      htmlFor="overwrite"
                      className="text-sm font-medium text-gray-900 cursor-pointer"
                    >
                      Overwrite existing AI profiles
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Replace existing AI analysis results for companies in this
                      list
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Cost & Time Estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Estimated Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${estimatedCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">~$0.20 per company</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Estimated Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {estimatedTime} min
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ~10 companies per minute
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4 border-t">
            <Link to="/ai">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              size="lg"
              onClick={handleCreateRun}
              disabled={!runName.trim() || createRunMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {createRunMutation.isPending ? "Creating Run..." : "Start Analysis"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
