import { Link } from "react-router-dom";
import { usePromptTemplates, useAIRuns } from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/default/ErrorState";
import { CheckCircle, XCircle, Loader, Clock, ArrowLeft } from "lucide-react";

export default function AILabRuns() {
  const { data: templates = [] } = usePromptTemplates();
  const { data: runs = [], isLoading: runsLoading, isError: runsError, error: runsErrorObj, refetch: refetchRuns } = useAIRuns();

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-primary" />;
      case "running":
        return <Loader className="w-4 h-4 text-primary animate-spin" />;
      case "queued":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <Link
            to="/ai"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to AI Lab
          </Link>
          <h1 className="text-base font-semibold text-foreground mb-2">Recent Runs</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your AI analysis runs
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          {runsError ? (
            <ErrorState
              message={runsErrorObj?.message ?? "Failed to load runs"}
              retry={() => refetchRuns()}
            />
          ) : runsLoading && sortedRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Loading runs...</p>
          ) : sortedRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No analysis runs yet. Create your first run to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedRuns.map((run) => {
                const template = templates.find((t) => t.id === run.template_id);
                return (
                  <div
                    key={run.id}
                    className="p-5 border border-border rounded-lg bg-card hover:border-border transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-foreground">{run.name}</span>
                      <span className="flex items-center gap-2">
                        {getStatusIcon(run.status)}
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">
                          {run.status === "running"
                            ? "Running"
                            : run.status === "completed"
                              ? "Completed"
                              : run.status === "failed"
                                ? "Failed"
                                : run.status === "queued"
                                  ? "Queued"
                                  : run.status}
                        </span>
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      {template?.name ?? "Template"} • {run.total_companies} companies •{" "}
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                    {(run.status === "running" || run.status === "queued") && (
                      <div className="mb-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${run.total_companies > 0 ? (run.processed_companies / run.total_companies) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {run.processed_companies} of {run.total_companies} analyzed
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {(run.status === "completed" || run.processed_companies > 0) && (
                        <Link to={`/ai/runs/${run.id}/results`}>
                          <Button variant="outline" size="sm" className="h-8">
                            View Results
                          </Button>
                        </Link>
                      )}
                      <Link to={`/ai/runs/${run.id}`}>
                        <Button variant="ghost" size="sm" className="h-8">
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
      </div>
    </div>
  );
}
