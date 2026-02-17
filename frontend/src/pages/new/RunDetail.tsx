import { useParams, Link } from "react-router-dom";
import { useAIRun } from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/new/ErrorState";
import { ArrowLeft } from "lucide-react";

export default function NewRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading, isError, error, refetch } = useAIRun(runId);

  if (isLoading && !run) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading run...</p>
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
            <Link to="/new/ai">
              <Button variant="outline" size="sm">Back to AI Lab</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <Link to="/new/ai">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{run.name}</h1>
        <p className="text-sm text-gray-600 mb-6">
          Status: {run.status} • {run.processed_companies}/{run.total_companies} companies
        </p>
        <Link to={`/new/ai/runs/${run.id}/results`}>
          <Button>View Results</Button>
        </Link>
      </div>
    </div>
  );
}
