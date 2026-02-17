import { Link } from "react-router-dom";
import { useLists, useDeleteList } from "@/lib/hooks/figmaQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/new/EmptyState";
import { ErrorState } from "@/components/new/ErrorState";
import { Trash2, ExternalLink } from "lucide-react";

function getStageLabel(stage: string) {
  switch (stage) {
    case "research":
      return "🔍 Research";
    case "ai_analysis":
      return "🤖 AI Analysis";
    case "prospects":
      return "🎯 Prospects";
    default:
      return stage;
  }
}

function ListCard({
  list,
  onDelete,
}: {
  list: { id: string; name: string; scope: string; stage: string; companyIds: string[]; created_at: string; created_by?: string; filters?: unknown };
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="new-card hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{getStageLabel(list.stage)}</span>
              {list.scope === "team" && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Shareable</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {list.companyIds.length} companies • {new Date(list.created_at).toLocaleDateString()}
            </p>
            {list.filters && (
              <p className="text-xs text-gray-500 mb-3">✓ Created from filters</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Link to={`/new/lists/${list.id}`}>
              <Button size="sm">
                Open <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`Delete "${list.name}"?`)) {
                  onDelete(list.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NewMyLists() {
  const { data: lists = [], isLoading, isError, error, refetch } = useLists();
  const deleteListMutation = useDeleteList();

  const privateLists = lists.filter((l) => l.scope === "private");
  const sharedLists = lists.filter((l) => l.scope === "team");

  const handleDelete = (id: string) => {
    deleteListMutation.mutate(id);
  };

  if (isError) {
    return (
      <div className="h-full overflow-auto new-bg flex items-center justify-center p-8">
        <ErrorState
          message={error?.message ?? "Failed to load lists"}
          retry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading lists...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto new-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">My Lists</h1>
          <p className="text-sm text-gray-600">Manage your saved company lists</p>
        </div>

        <div className="mb-8">
          <h2 className="text-base font-medium text-gray-900 mb-4">Private Lists</h2>
          {privateLists.length === 0 ? (
            <EmptyState
              title="No private lists yet"
              description="Create a list from Universe to get started"
              action={
                <Link to="/new/universe">
                  <Button size="sm">Create Your First List</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3">
              {privateLists.map((list) => (
                <ListCard key={list.id} list={list} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-medium text-gray-900 mb-4">Shareable Lists</h2>
          {sharedLists.length === 0 ? (
            <EmptyState
              title="No shared lists yet"
              description="Shareable lists will appear here"
            />
          ) : (
            <div className="grid gap-3">
              {sharedLists.map((list) => (
                <ListCard key={list.id} list={list} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
