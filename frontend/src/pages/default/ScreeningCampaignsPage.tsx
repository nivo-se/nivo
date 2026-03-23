import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createScreeningCampaign,
  listCampaignCandidates,
  listScreeningCampaigns,
  startScreeningCampaign,
} from "@/lib/api/screeningCampaigns/service";
import {
  getScreeningContext,
  listScreeningProfiles,
} from "@/lib/api/screeningProfiles/service";
import type { ScreeningProfileSummary } from "@/lib/api/screeningProfiles/types";
import { ScreeningProfileEditorDialog } from "@/components/screening/ScreeningProfileEditorDialog";
import type {
  ScreeningCampaignCandidate,
  ScreeningCampaignSummary,
} from "@/lib/api/screeningCampaigns/types";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Play, Plus, RefreshCw } from "lucide-react";

export default function ScreeningCampaignsPage() {
  const [profiles, setProfiles] = useState<ScreeningProfileSummary[]>([]);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<ScreeningCampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ScreeningCampaignCandidate[]>([]);
  const [candidatesTotal, setCandidatesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("Universe screening");
  const [profileId, setProfileId] = useState("");
  const [layer0Limit, setLayer0Limit] = useState(2000);

  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<"new" | "edit">("new");
  const [profileEditorId, setProfileEditorId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    const items = await listScreeningCampaigns();
    setCampaigns(items);
    return items;
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const items = await listScreeningProfiles("all");
      setProfiles(items);
      setProfileId((prev) => {
        if (prev && items.some((p) => p.id === prev)) return prev;
        return items[0]?.id ?? "";
      });
    } catch (e) {
      toast({
        title: "Could not load screening profiles",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadProfiles(),
          loadCampaigns(),
          getScreeningContext()
            .then((c) => {
              if (!cancelled) setContextUserId(c.userId);
            })
            .catch(() => {
              if (!cancelled) setContextUserId(null);
            }),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCampaigns, loadProfiles]);

  const loadCandidates = useCallback(async (id: string) => {
    const { rows, total } = await listCampaignCandidates(id, { limit: 200, offset: 0 });
    setCandidates(rows);
    setCandidatesTotal(total);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setCandidates([]);
      setCandidatesTotal(0);
      return;
    }
    loadCandidates(selectedId).catch((e) => {
      toast({
        title: "Failed to load candidates",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    });
  }, [selectedId, loadCandidates]);

  async function handleCreate() {
    if (!profileId) {
      toast({ title: "Select a screening profile", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { campaignId } = await createScreeningCampaign({
        name,
        profileId,
        params: { layer0Limit },
      });
      toast({ title: "Campaign created", description: campaignId });
      await loadCampaigns();
      setSelectedId(campaignId);
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(id: string) {
    setBusy(true);
    try {
      const result = await startScreeningCampaign(id);
      toast({
        title: "Layer 0 complete",
        description: JSON.stringify(result.layer0 ?? {}),
      });
      await loadCampaigns();
      if (selectedId === id) await loadCandidates(id);
    } catch (e) {
      toast({
        title: "Start failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const selected = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Screening campaigns</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Run a deterministic Layer 0 shortlist using a screening profile (same scoring as Universe).
        </p>
      </div>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-lg font-medium">New campaign</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="camp-name">Name</Label>
            <Input
              id="camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q1 universe pass"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="camp-profile">Screening profile</Label>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setProfileEditorMode("new");
                    setProfileEditorId(null);
                    setProfileEditorOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!profileId}
                  onClick={() => {
                    setProfileEditorMode("edit");
                    setProfileEditorId(profileId);
                    setProfileEditorOpen(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
            <select
              id="camp-profile"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              <option value="">— Select —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="camp-limit">Layer 0 cap</Label>
            <Input
              id="camp-limit"
              type="number"
              min={1}
              max={50000}
              value={layer0Limit}
              onChange={(e) => setLayer0Limit(Number(e.target.value) || 2000)}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={busy || loading}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create draft
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Campaigns</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCampaigns()}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <ul className="space-y-1">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                      selectedId === c.id
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="block truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.status}
                      {c.currentStage ? ` · ${c.currentStage}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">Run &amp; results</h2>
          {!selectedId || !selected ? (
            <p className="text-sm text-muted-foreground">Select a campaign to run Layer 0 and view rows.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Status: {selected.status}</span>
                {selected.errorMessage ? (
                  <span className="text-sm text-destructive truncate max-w-md">
                    {selected.errorMessage}
                  </span>
                ) : null}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleStart(selected.id)}
                  disabled={busy}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Run Layer 0
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Candidates: {candidatesTotal} (showing {candidates.length})
              </p>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>Org.nr</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Profile score</TableHead>
                      <TableHead>Archetype</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm">
                          No rows yet. Run Layer 0.
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidates.map((r) => (
                        <TableRow key={r.orgnr}>
                          <TableCell>{r.layer0Rank ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.orgnr}</TableCell>
                          <TableCell>{r.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {r.profileWeightedScore != null
                              ? r.profileWeightedScore.toFixed(4)
                              : "—"}
                          </TableCell>
                          <TableCell>{r.archetypeCode ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </section>

      <ScreeningProfileEditorDialog
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
        mode={profileEditorMode}
        profileId={profileEditorId}
        contextUserId={contextUserId}
        onSaved={async ({ profileId: savedId, selectProfileId }) => {
          await loadProfiles();
          if (selectProfileId && savedId) setProfileId(savedId);
        }}
      />
    </div>
  );
}
