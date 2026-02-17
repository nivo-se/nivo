import { Link } from "react-router-dom";
import { usePromptTemplates, useAIRuns } from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";

export default function NewAILab() {
  const {
    data: templates = [],
    isLoading: templatesLoading,
    isError: templatesError,
    error: templatesErrorObj,
    refetch: refetchTemplates,
  } = usePromptTemplates();
  const {
    data: runs = [],
    isLoading: runsLoading,
    isError: runsError,
    error: runsErrorObj,
    refetch: refetchRuns,
  } = useAIRuns();

  const mainError = templatesError || runsError;

  return (
    <div className="h-full overflow-auto new-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Lab</h1>
        <p className="text-sm text-gray-600 mb-8">Create and run AI analysis on your lists</p>

        <div className="grid gap-6">
          <Card className="new-card">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Prompt Templates</h2>
              {templatesError ? (
                <ErrorState
                  message={templatesErrorObj?.message ?? "Failed to load templates"}
                  retry={() => refetchTemplates()}
                />
              ) : templatesLoading && templates.length === 0 ? (
                <p className="text-sm text-gray-500">Loading templates...</p>
              ) : templates.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  description="Backend templates not implemented"
                />
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li key={t.id} className="text-sm text-gray-700">
                      {t.name}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="new-card">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">AI Runs</h2>
              {runsError ? (
                <ErrorState
                  message={runsErrorObj?.message ?? "Failed to load runs"}
                  retry={() => refetchRuns()}
                />
              ) : runsLoading && runs.length === 0 ? (
                <p className="text-sm text-gray-500">Loading runs...</p>
              ) : runs.length === 0 ? (
                <EmptyState
                  title="No runs yet"
                  description="Create a run to analyze a list"
                  action={
                    <Link to="/new/ai/run/create">
                      <Button size="sm">Create new run</Button>
                    </Link>
                  }
                />
              ) : (
                <>
                  <ul className="space-y-2 mb-4">
                    {runs.map((r) => (
                      <li key={r.id} className="text-sm">
                        <Link to={`/new/ai/runs/${r.id}`} className="text-blue-600 hover:underline">
                          {r.name} — {r.status}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link to="/new/ai/run/create">
                    <Button size="sm">Create new run</Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
