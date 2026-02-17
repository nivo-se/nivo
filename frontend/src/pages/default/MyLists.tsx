import { useState } from "react";
import { Link } from "react-router-dom";
import { useLists, useDeleteList } from "@/lib/hooks/figmaQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/default/EmptyState";
import { ErrorState } from "@/components/default/ErrorState";
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

function ListCard({
  list,
  onDeleteClick,
}: {
  list: { id: string; name: string; scope: string; stage: string; companyIds: string[]; created_at: string; updated_at?: string; created_by?: string; filters?: unknown };
  onDeleteClick: (id: string, name: string) => void;
}) {
  return (
    <Card className="app-card hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-foreground">{list.name}</h3>
              <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">{getStageLabel(list.stage)}</span>
              {list.scope === "team" && (
                <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">Shareable</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {list.companyIds.length} companies • Stage: {getStageLabel(list.stage)}
              {list.created_by && ` • Created by ${list.created_by}`}
              {" • Last edited "}
              {getTimeAgo(list.updated_at ?? list.created_at)}
            </p>
            {list.filters && (
              <p className="text-xs text-muted-foreground mb-3">✓ Created from filters</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Link to={`/lists/${list.id}`}>
              <Button variant="outline" size="sm">
                Open <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeleteClick(list.id, list.name)}
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const privateLists = lists.filter((l) => l.scope === "private");
  const sharedLists = lists.filter((l) => l.scope === "team");

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteListMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  if (isError) {
    return (
      <div className="h-full overflow-auto app-bg flex items-center justify-center p-8">
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
        <p className="text-muted-foreground">Loading lists...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">My Lists</h1>
          <p className="text-sm text-muted-foreground">Manage your saved company lists</p>
        </div>

        <div className="mb-8">
          <h2 className="text-base font-medium text-foreground mb-4">Private Lists</h2>
          {privateLists.length === 0 ? (
            <EmptyState
              title="No private lists yet"
              description="Create a list from Universe to get started"
              action={
                <Link to="/universe">
                  <Button variant="outline" size="sm">Create Your First List</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3">
              {privateLists.map((list) => (
                <ListCard key={list.id} list={list} onDeleteClick={handleDeleteClick} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-medium text-foreground mb-4">Shareable Lists</h2>
          {sharedLists.length === 0 ? (
            <EmptyState
              title="No shared lists yet"
              description="Shareable lists will appear here"
            />
          ) : (
            <div className="grid gap-3">
              {sharedLists.map((list) => (
                <ListCard key={list.id} list={list} onDeleteClick={handleDeleteClick} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the list. Companies won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
