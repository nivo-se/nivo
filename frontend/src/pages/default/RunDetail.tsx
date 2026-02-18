import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useAIRun,
  useList,
  usePromptTemplate,
  useCancelAIRun,
} from "@/lib/hooks/figmaQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Eye,
  Ban,
  Download,
} from "lucide-react";
import { ErrorState } from "@/components/default/ErrorState";
import * as api from "@/lib/services/figmaApi";
import { toast } from "sonner";

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { data: run, isLoading, isError, error, refetch } = useAIRun(runId);
  const { data: list } = useList(run?.list_id ?? "");
  const { data: template } = usePromptTemplate(run?.template_id ?? "");
  const cancelMutation = useCancelAIRun();

  if (isLoading && !run) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading run...</p>
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <ErrorState
          message={error?.message ?? "Run not found"}
          retry={() => refetch()}
          action={
            <Link to="/ai">
              <Button variant="outline" size="sm">
                Back to AI Lab
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const progressPercent =
    run.total_companies > 0
      ? (run.processed_companies / run.total_companies) * 100
      : 0;

  const getStatusBadge = () => {
    switch (run.status) {
      case "completed":
        return (
          <Badge className="bg-primary/15 text-primary">
            <CheckCircle className="w-3 h-3 mr-1" /> Completed
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-primary/15 text-primary">
            <Loader className="w-3 h-3 mr-1 animate-spin" /> Running
          </Badge>
        );
      case "queued":
        return (
          <Badge className="bg-muted text-foreground">
            <Clock className="w-3 h-3 mr-1" /> Queued
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/15 text-destructive">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-muted text-foreground">
            <Ban className="w-3 h-3 mr-1" /> Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this run?")) {
      cancelMutation.mutate(run.id);
    }
  };

  const handleExportReport = async () => {
    try {
      const results = await api.getRunResults(run.id);
      const headers = ["Company", "Score", "Recommendation", "Summary", "Strengths", "Concerns"];
      const rows = results.map((r) => [
        r.company_orgnr,
        r.overall_score,
        r.recommendation,
        (r.summary ?? "").replace(/"/g, '""'),
        (r.strengths ?? []).join("; ").replace(/"/g, '""'),
        (r.concerns ?? []).join("; ").replace(/"/g, '""'),
      ].map((v) => `"${String(v)}"`).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${run.name.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const canViewResults =
    run.status === "completed" || run.processed_companies > 0;

  return (
    <div className="h-full overflow-auto bg-muted/40">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-6">
          <Link to="/ai">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-foreground mb-2">
                {run.name}
              </h1>
              <p className="text-muted-foreground">
                Created by {run.created_by} •{" "}
                {new Date(run.created_at).toLocaleDateString()} at{" "}
                {new Date(run.created_at).toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              {canViewResults && (
                <>
                  <Button
                    onClick={() =>
                      navigate(`/ai/runs/${run.id}/results`)
                    }
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                  {run.status === "completed" && (
                    <Button
                      variant="outline"
                      onClick={handleExportReport}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Report
                    </Button>
                  )}
                </>
              )}
              {(run.status === "running" || run.status === "queued") && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Cancel Run
                </Button>
              )}
            </div>
          </div>
        </div>

        {(run.status === "running" || run.status === "queued") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Analyzing companies...
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {run.processed_companies} / {run.total_companies}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
                {run.status === "running" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing... This may take a few minutes.</span>
                    </div>
                    {run.total_companies > 0 && run.processed_companies < run.total_companies && (
                      <p className="text-xs text-muted-foreground">
                        ~{Math.max(1, Math.ceil((run.total_companies - run.processed_companies) * 0.5))} minutes remaining
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Companies</p>
              <p className="text-base font-bold text-foreground">
                {run.total_companies}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Processed</p>
              <p className="text-base font-bold text-primary">
                {run.processed_companies}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Failed</p>
              <p className="text-base font-bold text-destructive">
                {run.failed_companies}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Cost</p>
              <p className="text-base font-bold text-foreground">
                $
                {run.status === "completed"
                  ? run.actual_cost.toFixed(2)
                  : run.estimated_cost.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {run.status === "completed" ? "Actual" : "Estimated"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Template</dt>
                  <dd className="text-sm text-foreground mt-1">
                    {template?.name ?? run.template_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Target List
                  </dt>
                  <dd className="text-sm text-foreground mt-1">
                    {list ? (
                      <Link
                        to={`/lists/${list.id}`}
                        className="text-primary hover:underline"
                      >
                        {list.name}
                      </Link>
                    ) : (
                      run.list_id
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Auto-approve Results
                  </dt>
                  <dd className="text-sm text-foreground mt-1">
                    {run.config.auto_approve
                      ? "Yes"
                      : "No (manual review required)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Overwrite Existing
                  </dt>
                  <dd className="text-sm text-foreground mt-1">
                    {run.config.overwrite_existing ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="text-sm text-foreground mt-1">
                    {new Date(run.created_at).toLocaleString()}
                  </dd>
                </div>
                {run.started_at && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Started
                    </dt>
                    <dd className="text-sm text-foreground mt-1">
                      {new Date(run.started_at).toLocaleString()}
                    </dd>
                  </div>
                )}
                {run.completed_at && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Completed
                    </dt>
                    <dd className="text-sm text-foreground mt-1">
                      {new Date(run.completed_at).toLocaleString()}
                    </dd>
                  </div>
                )}
                {run.started_at && run.completed_at && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Duration
                    </dt>
                    <dd className="text-sm text-foreground mt-1">
                      {Math.ceil(
                        (new Date(run.completed_at).getTime() -
                          new Date(run.started_at).getTime()) /
                          1000 /
                          60
                      )}{" "}
                      minutes
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
