import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLists, useDeleteList, useUpdateList } from "@/lib/hooks/apiQueries";
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
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/default/EmptyState";
import { ErrorState } from "@/components/default/ErrorState";
import { Trash2, ExternalLink, RefreshCw, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

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

function formatCreatedBy(
  createdBy: string | undefined,
  createdByName: string | undefined,
  currentUserId: string | undefined
): string {
  if (!createdBy) return "";
  if (createdBy === currentUserId) return "You";
  if (createdBy === "00000000-0000-0000-0000-000000000001") return "System";
  return createdByName ?? "Another user";
}

function ListCard({
  list,
  currentUserId,
  isOwnList,
  onDeleteClick,
  onScopeChange,
  onRename,
  isUpdatingScope,
}: {
  list: { id: string; name: string; scope: string; stage: string; companyIds: string[]; created_at: string; updated_at?: string; created_by?: string; created_by_name?: string; owner_user_id?: string; filters?: unknown };
  currentUserId: string | undefined;
  isOwnList: boolean;
  onDeleteClick: (id: string, name: string) => void;
  onScopeChange?: (listId: string, scope: "private" | "team") => void;
  onRename?: (listId: string, name: string) => void;
  isUpdatingScope?: boolean;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(list.name);
  const isPublic = list.scope === "team";

  const handleStartRename = () => {
    if (!isOwnList || !onRename) return;
    setEditName(list.name);
    setIsEditingName(true);
  };

  const handleCommitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== list.name && onRename) {
      onRename(list.id, trimmed);
    }
    setIsEditingName(false);
    setEditName(list.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCommitRename();
    if (e.key === "Escape") {
      setEditName(list.name);
      setIsEditingName(false);
    }
  };

  return (
    <Card className="app-card hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {isEditingName ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={handleKeyDown}
                  className="text-base font-semibold h-8 max-w-[240px]"
                  autoFocus
                  aria-label="List name"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleStartRename}
                  className={`flex items-center gap-2 text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors group ${isOwnList && onRename ? "cursor-pointer" : "cursor-default"}`}
                  disabled={!isOwnList || !onRename}
                >
                  <h3 className="text-base font-semibold text-foreground">{list.name}</h3>
                  {isOwnList && onRename && (
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden />
                  )}
                </button>
              )}
              <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">{getStageLabel(list.stage)}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {list.companyIds.length} companies • Stage: {getStageLabel(list.stage)}
              {list.created_by && ` • Created by ${formatCreatedBy(list.created_by, list.created_by_name, currentUserId)}`}
              {" • Last edited "}
              {getTimeAgo(list.updated_at ?? list.created_at)}
            </p>
            {list.filters && (
              <p className="text-xs text-muted-foreground mb-3">✓ Created from filters</p>
            )}
            {isOwnList && onScopeChange && (
              <label className="flex items-center gap-2 mt-2 text-sm text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={isPublic}
                  disabled={isUpdatingScope}
                  onCheckedChange={(checked) => {
                    onScopeChange(list.id, checked === true ? "team" : "private");
                  }}
                  className="border-border data-[state=checked]:border-border data-[state=checked]:bg-muted"
                />
                <span>Public (visible to everyone)</span>
              </label>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Link to={`/lists/${list.id}`}>
              <Button variant="outline" size="sm">
                Open <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            {isOwnList && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDeleteClick(list.id, list.name)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyLists() {
  const { user } = useAuth();
  const { data: lists = [], isLoading, isError, error, refetch } = useLists();
  const deleteListMutation = useDeleteList();
  const updateListMutation = useUpdateList();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const currentUserId = user?.id ?? DEV_USER_ID;
  const getOwnerId = (l: { owner_user_id?: string; created_by?: string }) => l.owner_user_id ?? l.created_by;
  const hasOwnerMatch = lists.some((l) => getOwnerId(l) === currentUserId);
  const myLists = lists.filter((l) => {
    const ownerId = getOwnerId(l);
    if (ownerId === currentUserId) return true;
    // Fallback for auth-disabled/local setups where backend and frontend user IDs drift.
    return !hasOwnerMatch && l.scope === "private";
  });
  const myListIds = new Set(myLists.map((l) => l.id));
  const sharedLists = lists.filter((l) => l.scope === "team" && !myListIds.has(l.id));

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteListMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleScopeChange = (listId: string, scope: "private" | "team") => {
    updateListMutation.mutate({ listId, data: { scope } });
  };

  const handleRename = (listId: string, name: string) => {
    updateListMutation.mutate({ listId, data: { name } });
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
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-foreground mb-2">My Lists</h1>
            <p className="text-sm text-muted-foreground">Manage your saved company lists</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-8">
          <h2 className="text-base font-medium text-foreground mb-4">My Lists</h2>
          <p className="text-sm text-muted-foreground mb-4">All your lists. Mark a list as Public to let others see it in Shared lists.</p>
          {myLists.length === 0 ? (
            <EmptyState
              title="No lists yet"
              description={
                <>
                  Create a list from Universe to get started.
                  {lists.length === 0 && (
                    <span className="block mt-2 text-xs text-muted-foreground">
                      Lists require the FastAPI backend with <code className="bg-muted px-1 rounded">DATABASE_SOURCE=postgres</code>. Run:{" "}
                      <code className="bg-muted px-1 rounded text-xs">cd backend && DATABASE_SOURCE=postgres uvicorn api.main:app --port 8000</code>
                    </span>
                  )}
                </>
              }
              action={
                <Link to="/universe">
                  <Button variant="outline" size="sm">Create Your First List</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3">
              {myLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  currentUserId={currentUserId}
                  isOwnList
                  onDeleteClick={handleDeleteClick}
                  onScopeChange={handleScopeChange}
                  onRename={handleRename}
                  isUpdatingScope={updateListMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-medium text-foreground mb-4">Public lists</h2>
          <p className="text-sm text-muted-foreground mb-4">Lists shared by others (marked as public by their owners).</p>
          {sharedLists.length === 0 ? (
            <EmptyState
              title="No public lists from others"
              description="When other users mark a list as Public, it will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {sharedLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  currentUserId={currentUserId}
                  isOwnList={false}
                  onDeleteClick={handleDeleteClick}
                />
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
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
