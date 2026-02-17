import { useParams, Link } from "react-router-dom";
import { useAIRun, useRunResults } from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";
import { ArrowLeft } from "lucide-react";

export default function NewRunResults() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isError: runError, error: runErrorObj, refetch: refetchRun } = useAIRun(runId);
  const { data: results = [], isLoading, isError: resultsError, error: resultsErrorObj, refetch: refetchResults } = useRunResults(runId ?? "");

  const err = runError || resultsError;
  const errMsg = runError ? runErrorObj?.message : resultsErrorObj?.message;

  if (err) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <ErrorState
          message={errMsg ?? "Failed to load results"}
          retry={() => { refetchRun(); refetchResults(); }}
          action={
            <Link to="/new/ai">
              <Button variant="outline" size="sm">Back to AI Lab</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <Link to={`/new/ai/runs/${runId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Run
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Results — {run?.name ?? runId}</h1>
        <p className="text-sm text-gray-600 mb-6">{results.length} companies analyzed</p>
        {results.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Analysis may still be running or no companies were processed."
          />
        ) : (
        <div className="space-y-2">
          {results.slice(0, 20).map((r) => (
            <div key={r.id} className="bg-white rounded border border-gray-200 p-4">
              <Link to={`/new/company/${r.company_orgnr}`} className="text-blue-600 hover:underline font-medium">
                {r.company_orgnr}
              </Link>
              <p className="text-sm text-gray-600 mt-1">Score: {r.overall_score} • {r.recommendation}</p>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
