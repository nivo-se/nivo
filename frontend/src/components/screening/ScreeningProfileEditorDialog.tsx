import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  activateProfileVersion,
  createProfileVersion,
  createScreeningProfile,
  deleteScreeningProfile,
  getScreeningProfile,
  updateScreeningProfile,
} from "@/lib/api/screeningProfiles/service";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const EMPTY_CONFIG_TEXT = `{
  "variables": [],
  "weights": {},
  "archetypes": [],
  "exclusion_rules": []
}`;

export type ScreeningProfileEditorMode = "new" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScreeningProfileEditorMode;
  /** Required when mode is edit */
  profileId: string | null;
  /** Current user id from GET /api/screening/context */
  contextUserId: string | null;
  onSaved: (opts: { profileId: string; selectProfileId?: boolean }) => void;
};

export function ScreeningProfileEditorDialog({
  open,
  onOpenChange,
  mode,
  profileId,
  contextUserId,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"private" | "team">("private");
  const [configText, setConfigText] = useState(EMPTY_CONFIG_TEXT);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const canEdit =
    mode === "new" ||
    (contextUserId != null && ownerUserId != null && contextUserId === ownerUserId);

  const resetForNew = useCallback(() => {
    setName("My screening profile");
    setDescription("");
    setScope("private");
    setConfigText(EMPTY_CONFIG_TEXT);
    setOwnerUserId(null);
    setJsonError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "new") {
      resetForNew();
      return;
    }
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    setJsonError(null);
    (async () => {
      try {
        const p = await getScreeningProfile(profileId);
        if (cancelled) return;
        setName(p.name ?? "");
        setDescription(p.description ?? "");
        setScope((p.scope === "team" ? "team" : "private") as "private" | "team");
        setOwnerUserId(p.ownerUserId ?? null);
        const cfg = p.activeConfig;
        setConfigText(
          cfg && typeof cfg === "object"
            ? JSON.stringify(cfg, null, 2)
            : EMPTY_CONFIG_TEXT
        );
      } catch (e) {
        toast({
          title: "Failed to load profile",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
        onOpenChange(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, profileId, onOpenChange, resetForNew]);

  function parseConfig(): Record<string, unknown> {
    const t = configText.trim();
    if (!t) {
      throw new Error("Config JSON is empty");
    }
    const parsed: unknown = JSON.parse(t);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Config must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  }

  function handleFormatJson() {
    setJsonError(null);
    try {
      const p = parseConfig();
      setConfigText(JSON.stringify(p, null, 2));
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSave() {
    setJsonError(null);
    let config: Record<string, unknown>;
    try {
      config = parseConfig();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setJsonError(msg);
      toast({ title: "Invalid JSON", description: msg, variant: "destructive" });
      return;
    }

    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    if (!canEdit) {
      toast({ title: "Not allowed", description: "Only the profile owner can save changes.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (mode === "new") {
        const created = await createScreeningProfile({
          name: name.trim(),
          description: description.trim() || undefined,
          scope,
        });
        const pid = created.id;
        const ver = await createProfileVersion(pid, config);
        await activateProfileVersion(pid, ver.id);
        toast({ title: "Profile created", description: "New version is active." });
        onSaved({ profileId: pid, selectProfileId: true });
        onOpenChange(false);
        return;
      }

      if (!profileId) return;
      await updateScreeningProfile(profileId, {
        name: name.trim(),
        description: description.trim() || null,
        scope,
      });
      const ver = await createProfileVersion(profileId, config);
      await activateProfileVersion(profileId, ver.id);
      toast({ title: "Profile updated", description: "Saved metadata and activated a new config version." });
      onSaved({ profileId, selectProfileId: false });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!profileId || mode !== "edit") return;
    if (!canEdit) {
      toast({ title: "Not allowed", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete screening profile "${name}" and all its versions? This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteScreeningProfile(profileId);
      toast({ title: "Profile deleted" });
      onSaved({ profileId: "", selectProfileId: false });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "New screening profile" : "Edit screening profile"}</DialogTitle>
          <DialogDescription>
            Scoring model: <code className="text-xs">variables</code>, <code className="text-xs">weights</code>,{" "}
            <code className="text-xs">archetypes</code>, <code className="text-xs">exclusion_rules</code>. Saving creates a
            new version and activates it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading profile…
          </div>
        ) : (
          <div className="space-y-4">
            {!canEdit && mode === "edit" ? (
              <p className="text-sm text-amber-600 dark:text-amber-500 border border-amber-500/30 rounded-md p-2">
                You are not the owner of this profile (owner user id differs from your session). View only — create a new
                profile to use a custom config.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sp-name">Name</Label>
                <Input
                  id="sp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  placeholder="e.g. Q1 Nordic growth"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sp-desc">Description</Label>
                <Input
                  id="sp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-scope">Scope</Label>
                <select
                  id="sp-scope"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "private" | "team")}
                  disabled={!canEdit}
                >
                  <option value="private">Private (only you)</option>
                  <option value="team">Team (shared)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sp-config">Config JSON</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleFormatJson} disabled={!canEdit}>
                  Format
                </Button>
              </div>
              <Textarea
                id="sp-config"
                className="font-mono text-xs min-h-[220px]"
                value={configText}
                onChange={(e) => {
                  setConfigText(e.target.value);
                  setJsonError(null);
                }}
                disabled={!canEdit}
                spellCheck={false}
              />
              {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "edit" && profileId && canEdit ? (
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={saving || loading}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={saving || loading || !canEdit}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === "new" ? "Create profile" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
