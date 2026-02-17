import { Link } from "react-router-dom";
import { useCompaniesWithTotal, useLists, useProspects, useAIRuns } from "@/lib/hooks/figmaQueries";
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
  const { data: universeData } = useCompaniesWithTotal({ limit: 1 });
  const companies = universeData?.companies ?? [];
  const totalCompanies = universeData?.total ?? 0;
  const { data: lists = [] } = useLists();
  const { data: prospects = [] } = useProspects();
  const { data: runs = [] } = useAIRuns();

  const researchLists = lists.filter((l) => l.stage === "research");
  const aiAnalysisLists = lists.filter((l) => l.stage === "ai_analysis");

  const prospectsByStatus = {
    new: prospects.filter((p) => p.status === "new").length,
    contacted: prospects.filter((p) => p.status === "contacted").length,
    in_discussion: prospects.filter((p) => p.status === "in_discussion").length,
    interested: prospects.filter((p) => p.status === "interested").length,
    not_interested: prospects.filter((p) => p.status === "not_interested").length,
  };

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-foreground mb-2">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your investment pipeline</p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="app-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Companies</p>
            <p className="text-base font-semibold text-foreground">{totalCompanies.toLocaleString()}</p>
          </div>
          <div className="app-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Active Lists</p>
            <p className="text-base font-semibold text-foreground">{lists.length}</p>
          </div>
          <div className="app-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Prospects</p>
            <p className="text-base font-semibold text-foreground">{prospects.length}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-foreground">My Lists</h2>
            <Link to="/lists" className="text-sm text-muted-foreground hover:text-foreground">
              View All
            </Link>
          </div>

          {researchLists.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase">Research</h3>
              <div className="space-y-3">
                {researchLists.map((list) => (
                  <div key={list.id} className="app-card p-5 hover:border-border transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground mb-2">{list.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {list.companyIds.length} companies • Last edited {getTimeAgo(list.updated_at)}
                        </p>
                      </div>
                      <Link to={`/lists/${list.id}`}>
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
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase">AI Analysis</h3>
              <div className="space-y-3">
                {aiAnalysisLists.map((list) => {
                  const activeRun = runs.find((r) => r.list_id === list.id && (r.status === "running" || r.status === "queued"));
                  return (
                    <div key={list.id} className="app-card p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">{list.name}</h4>
                          <p className="text-sm text-muted-foreground">Running analysis...</p>
                        </div>
                        {activeRun ? (
                          <Link to={`/ai/runs/${activeRun.id}`}>
                            <Button size="sm" variant="outline" className="text-sm h-8">
                              View Progress
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/lists/${list.id}`}>
                            <Button size="sm" variant="outline" className="text-sm h-8">
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lists.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No lists yet</p>
              <Link to="/universe">
                  <Button variant="outline" className="mt-4 text-sm h-9">Create your first list</Button>
              </Link>
            </CardContent>
          </Card>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-foreground">Team Prospects</h2>
            <Link to="/prospects" className="text-sm text-muted-foreground hover:text-foreground">
              View All
            </Link>
          </div>
          <div className="app-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-sm font-medium text-foreground">{prospects.length} Companies in Pipeline</h3>
            </div>
            <div className="grid grid-cols-5 gap-6">
              <div>
                <p className="text-base font-semibold text-foreground">{prospectsByStatus.new}</p>
                <p className="text-sm text-muted-foreground mt-2">New</p>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{prospectsByStatus.contacted}</p>
                <p className="text-sm text-muted-foreground mt-2">Contacted</p>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{prospectsByStatus.in_discussion}</p>
                <p className="text-sm text-muted-foreground mt-2">In Discussion</p>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{prospectsByStatus.interested}</p>
                <p className="text-sm text-muted-foreground mt-2">Interested</p>
              </div>
              <div>
                <p className="text-base font-semibold text-muted-foreground">{prospectsByStatus.not_interested}</p>
                <p className="text-sm text-muted-foreground mt-2">Not Interested</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
