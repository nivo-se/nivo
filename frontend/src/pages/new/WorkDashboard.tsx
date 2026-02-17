import { Link } from "react-router-dom";
import { useCompanies, useLists, useProspects } from "@/lib/hooks/figmaQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

export default function NewWorkDashboard() {
  const { data: companies = [] } = useCompanies({ limit: 500 });
  const { data: lists = [] } = useLists();
  const { data: prospects = [] } = useProspects();

  const researchLists = lists.filter((l) => l.stage === "research");
  const aiAnalysisLists = lists.filter((l) => l.stage === "ai_analysis");

  return (
    <div className="h-full overflow-auto new-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-sm text-gray-600">Here&apos;s what&apos;s happening with your investment pipeline</p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="new-card p-6">
            <p className="text-sm text-gray-600 mb-2">Total Companies</p>
            <p className="text-2xl font-semibold text-gray-900">{companies.length.toLocaleString()}+</p>
          </div>
          <div className="new-card p-6">
            <p className="text-sm text-gray-600 mb-2">Active Lists</p>
            <p className="text-2xl font-semibold text-gray-900">{lists.length}</p>
          </div>
          <div className="new-card p-6">
            <p className="text-sm text-gray-600 mb-2">Prospects</p>
            <p className="text-2xl font-semibold text-gray-900">{prospects.length}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-900">My Lists</h2>
            <Link to="/new/lists" className="text-sm text-gray-600 hover:text-gray-900">
              View All
            </Link>
          </div>

          {researchLists.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Research</h3>
              <div className="space-y-3">
                {researchLists.map((list) => (
                  <div key={list.id} className="new-card p-5 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{list.name}</h4>
                        <p className="text-sm text-gray-600">
                          {list.companyIds.length} companies • Last edited {getTimeAgo(list.updated_at)}
                        </p>
                      </div>
                      <Link to={`/new/lists/${list.id}`}>
                        <Button size="sm" variant="outline" className="text-sm h-8">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiAnalysisLists.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">AI Analysis</h3>
              <div className="space-y-3">
                {aiAnalysisLists.map((list) => (
                  <div key={list.id} className="new-card p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{list.name}</h4>
                        <p className="text-sm text-gray-600">Running analysis...</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-sm h-8">
                        View Progress
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lists.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-gray-500">No lists yet</p>
                <Link to="/new/universe">
                  <Button className="mt-4 text-sm h-9">Create your first list</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {prospects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">Team Prospects</h2>
              <Link to="/new/prospects" className="text-sm text-gray-600 hover:text-gray-900">
                View All
              </Link>
            </div>
            <div className="new-card p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">{prospects.length} Companies in Pipeline</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
