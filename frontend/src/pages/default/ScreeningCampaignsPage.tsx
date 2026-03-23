import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  deleteScreeningCampaign,
  listCampaignCandidates,
  listScreeningCampaigns,
  patchCandidateExclusion,
  patchScreeningCampaign,
  startScreeningCampaign,
} from "@/lib/api/screeningCampaigns/service";
import {
  getScreeningContext,
  listScreeningProfiles,
} from "@/lib/api/screeningProfiles/service";
import type { ScreeningProfileSummary } from "@/lib/api/screeningProfiles/types";
import { ScreeningProfileEditorDialog } from "@/components/screening/ScreeningProfileEditorDialog";
import {
  getEnrichmentRunStatus,
  listEnrichmentRuns,
  runEnrichmentForScreeningCampaign,
  type EnrichmentRunStatus,
  type EnrichmentRunSummary,
} from "@/lib/api/enrichmentService";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ScreeningCampaignCandidate,
  ScreeningCampaignSummary,
} from "@/lib/api/screeningCampaigns/types";
import { toast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FileSearch,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

/** Swedish SNI 2007 section prefixes — exclude haulage (49), finance/holdings (64), etc. */
const SNI_PREFIX_PRESETS: { prefix: string; label: string }[] = [
  { prefix: "49", label: "49 — Land transport (Åkeri, spedition…)" },
  { prefix: "64", label: "64 — Financial & holding (e.g. PE vehicles)" },
  { prefix: "66", label: "66 — Insurance & pension funds" },
  { prefix: "52", label: "52 — Warehousing & transport support" },
];

function buildDeepResearchHandoffUrl(
  orgnr: string,
  opts: { name?: string | null; campaignName?: string | null }
) {
  const p = new URLSearchParams();
  p.set("orgnr", orgnr);
  p.set("from", "screening");
  if (opts.name?.trim()) p.set("name", opts.name.trim());
  if (opts.campaignName?.trim()) p.set("campaign", opts.campaignName.trim());
  return `/deep-research?${p.toString()}`;
}

/** Human-readable Layer 0 stats from POST /screening/campaigns/:id/start */
function formatLayer0Summary(layer0: Record<string, unknown> | undefined): string {
  if (!layer0 || typeof layer0 !== "object") {
    return "Layer 0 finished. The candidate table below was updated.";
  }
  const kept = layer0.kept;
  const total = layer0.total_matched;
  const limit = layer0.layer0_limit;
  const scanned = layer0.scanned_rows;
  const parts: string[] = [];
  if (typeof kept === "number") parts.push(`Kept ${kept} companies`);
  if (typeof total === "number") parts.push(`${total} matched the universe query`);
  if (typeof limit === "number") parts.push(`cap ${limit}`);
  if (typeof scanned === "number") parts.push(`scanned ${scanned} rows`);
  if (parts.length === 0) return "Layer 0 finished. The candidate table below was updated.";
  return `${parts.join(" · ")}. Shortlist refreshed below.`;
}

export default function ScreeningCampaignsPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ScreeningProfileSummary[]>([]);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<ScreeningCampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ScreeningCampaignCandidate[]>([]);
  const [candidatesTotal, setCandidatesTotal] = useState(0);
  /** Profiles load independently so "Create draft" is not blocked by a slow campaign list. */
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsLoadError, setCampaignsLoadError] = useState<string | null>(null);
  const [profilesLoadError, setProfilesLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("Universe screening");
  const [profileId, setProfileId] = useState("");
  const DEFAULT_LAYER0_CAP = 20;
  const [layer0Limit, setLayer0Limit] = useState(DEFAULT_LAYER0_CAP);
  /** Rename field for selected campaign */
  const [campaignRename, setCampaignRename] = useState("");
  /** SNI/NACE 2–5 digit prefixes to drop (any code on the company starting with one of these). */
  const [excludedSniPrefixes, setExcludedSniPrefixes] = useState<Set<string>>(
    () => new Set(["49", "64"])
  );
  const [customSniPrefixes, setCustomSniPrefixes] = useState("");

  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<"new" | "edit">("new");
  const [profileEditorId, setProfileEditorId] = useState<string | null>(null);
  const [enrichmentRuns, setEnrichmentRuns] = useState<EnrichmentRunSummary[]>([]);
  const [enrichmentRunsLoading, setEnrichmentRunsLoading] = useState(false);
  const [expandedEnrichmentRunId, setExpandedEnrichmentRunId] = useState<string | null>(null);
  const [enrichmentStatusByRun, setEnrichmentStatusByRun] = useState<Record<string, EnrichmentRunStatus>>({});
  const [loadingEnrichmentDetailId, setLoadingEnrichmentDetailId] = useState<string | null>(null);
  /** Collapsible "Campaign results" under the campaign list (Layer 0 + enrichment runs). */
  const [campaignResultsOpen, setCampaignResultsOpen] = useState(true);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const c = campaigns.find((x) => x.id === selectedId);
    setCampaignRename(c?.name ?? "");
  }, [selectedId, campaigns]);

  const loadCampaigns = useCallback(async () => {
    try {
      const items = await listScreeningCampaigns();
      setCampaigns(items);
      setCampaignsLoadError(null);
      return items;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCampaignsLoadError(msg);
      toast({
        title: "Could not load campaigns",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const items = await listScreeningProfiles("all");
      setProfiles(items);
      setProfilesLoadError(null);
      setProfileId((prev) => {
        if (prev && items.some((p) => p.id === prev)) return prev;
        return items[0]?.id ?? "";
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProfilesLoadError(msg);
      toast({
        title: "Could not load screening profiles",
        description: msg,
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      try {
        await loadProfiles();
        getScreeningContext()
          .then((c) => {
            if (!cancelled) setContextUserId(c.userId);
          })
          .catch(() => {
            if (!cancelled) setContextUserId(null);
          });
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfiles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCampaignsLoading(true);
      try {
        await loadCampaigns();
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCampaigns]);

  const loadCandidates = useCallback(async (id: string) => {
    const { rows, total } = await listCampaignCandidates(id, {
      limit: 200,
      offset: 0,
      includeEnrichment: true,
    });
    setCandidates(rows);
    setCandidatesTotal(total);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setCandidates([]);
      setCandidatesTotal(0);
      setEnrichmentRuns([]);
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

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setExpandedEnrichmentRunId(null);
    setEnrichmentRunsLoading(true);
    listEnrichmentRuns({ campaignId: selectedId, limit: 15 })
      .then((items) => {
        if (!cancelled) setEnrichmentRuns(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setEnrichmentRuns([]);
          toast({
            title: "Could not load enrichment runs",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setEnrichmentRunsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function mergedSniExclusions(): string[] {
    const extra = customSniPrefixes
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([...excludedSniPrefixes, ...extra])];
  }

  /** Create campaign in Postgres, then run Layer 0 immediately (single primary action). */
  async function handleCreateAndRunLayer0() {
    if (!profileId) {
      toast({ title: "Select a screening profile", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const prefixes = mergedSniExclusions().filter((p) => /^\d{2,5}$/.test(p));
      const naceFilters =
        prefixes.length > 0
          ? [
              {
                field: "nace_codes",
                op: "excludes_prefixes",
                type: "nace",
                value: prefixes,
              },
            ]
          : [];

      const { campaignId } = await createScreeningCampaign({
        name,
        profileId,
        params: { layer0Limit },
        filters: naceFilters,
      });
      await loadCampaigns();
      setSelectedId(campaignId);

      const result = await startScreeningCampaign(campaignId);
      const layer0 = result.layer0 as Record<string, unknown> | undefined;
      toast({
        title: "Layer 0 complete",
        description: formatLayer0Summary(layer0),
      });
      await loadCampaigns();
      await loadCandidates(campaignId);
    } catch (e) {
      toast({
        title: "Campaign run failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCampaign(id: string, name: string) {
    if (
      !window.confirm(
        `Delete campaign "${name}"? This removes its candidates and stages. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteScreeningCampaign(id);
      toast({ title: "Campaign deleted", description: name });
      if (selectedId === id) setSelectedId(null);
      await loadCampaigns();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameCampaign() {
    if (!selectedId || !selected) return;
    const next = campaignRename.trim();
    if (!next || next === selected.name) return;
    setBusy(true);
    try {
      const updated = await patchScreeningCampaign(selectedId, { name: next });
      toast({ title: "Campaign renamed", description: updated.name });
      await loadCampaigns();
      setCampaignRename(updated.name);
    } catch (e) {
      toast({
        title: "Rename failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleExclusion(
    campaignId: string,
    orgnr: string,
    nextExcluded: boolean,
    previousExcluded: boolean
  ) {
    try {
      await patchCandidateExclusion(campaignId, orgnr, {
        excludedFromAnalysis: nextExcluded,
        exclusionReason: nextExcluded ? "Marked from screening UI" : null,
      });
      setCandidates((prev) =>
        prev.map((row) =>
          row.orgnr === orgnr
            ? {
                ...row,
                excludedFromAnalysis: nextExcluded,
                exclusionReason: nextExcluded ? "Marked from screening UI" : null,
              }
            : row
        )
      );
    } catch (e) {
      toast({
        title: "Could not update exclusion",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setCandidates((prev) =>
        prev.map((row) =>
          row.orgnr === orgnr ? { ...row, excludedFromAnalysis: previousExcluded } : row
        )
      );
    }
  }

  async function handleEnrichPublic(campaignId: string) {
    setBusy(true);
    let runId = "";
    try {
      const out = await runEnrichmentForScreeningCampaign(campaignId);
      runId = out.runId;
      setCampaignResultsOpen(true);
      toast({
        title: "Enrichment started",
        description:
          `Run ${runId.slice(0, 8)}… — ${out.queuedCount} companies. ` +
          `Results are written to Postgres (enrichment_runs, company_enrichment, ai_profiles). ` +
          `Open Campaign results (left) to watch progress; the table refreshes as rows complete.`,
      });
      setEnrichmentRuns(await listEnrichmentRuns({ campaignId, limit: 15 }));
    } catch (e) {
      toast({
        title: "Enrichment failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      return;
    } finally {
      setBusy(false);
    }
    if (!runId) return;
    void (async () => {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await getEnrichmentRunStatus(runId);
        if (st) setEnrichmentStatusByRun((prev) => ({ ...prev, [runId]: st }));
        try {
          setEnrichmentRuns(await listEnrichmentRuns({ campaignId, limit: 15 }));
        } catch {
          /* ignore */
        }
        if (selectedIdRef.current === campaignId) {
          try {
            await loadCandidates(campaignId);
          } catch {
            /* ignore */
          }
        }
        if (st && (st.completed > 0 || st.failed > 0)) break;
      }
    })();
  }

  async function handleStart(id: string) {
    setBusy(true);
    try {
      const result = await startScreeningCampaign(id);
      const layer0 = result.layer0 as Record<string, unknown> | undefined;
      toast({
        title: "Layer 0 complete",
        description: formatLayer0Summary(layer0),
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

  function formatShortDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function toggleEnrichmentRunDetail(runId: string) {
    if (expandedEnrichmentRunId === runId) {
      setExpandedEnrichmentRunId(null);
      return;
    }
    setExpandedEnrichmentRunId(runId);
    if (enrichmentStatusByRun[runId]) return;
    setLoadingEnrichmentDetailId(runId);
    try {
      const st = await getEnrichmentRunStatus(runId);
      if (st) setEnrichmentStatusByRun((prev) => ({ ...prev, [runId]: st }));
    } finally {
      setLoadingEnrichmentDetailId(null);
    }
  }

  const enrichDisabledReason =
    busy
      ? "Wait for the current operation to finish."
      : candidatesTotal === 0
        ? "Run Layer 0 first so this campaign has candidates."
        : undefined;

  const runNewCampaignDisabledReason =
    busy
      ? "Wait for the current operation to finish."
      : profilesLoading
        ? "Loading screening profiles…"
        : profilesLoadError
          ? "Fix the screening profile load error above, then retry."
          : profiles.length === 0
            ? "Create a screening profile first (see the notice above)."
            : !profileId
              ? "Select a screening profile in the dropdown."
              : undefined;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <BackendStatusBanner />
      {campaignsLoadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Campaign list failed to load: {campaignsLoadError}. Use Refresh or reload the page.
        </div>
      ) : null}
      {profilesLoadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            Screening profiles failed to load: {profilesLoadError}. You need at least one profile to create a draft
            campaign.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                setProfilesLoading(true);
                try {
                  await loadProfiles();
                } finally {
                  setProfilesLoading(false);
                }
              })();
            }}
            disabled={profilesLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${profilesLoading ? "animate-spin" : ""}`} />
            Retry profiles
          </Button>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Screening campaigns</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Layer 0 ranks by profile score. Use <strong>SNI exclusions</strong> to remove weak financial fits
          (e.g. Åkeri, PE/holding shells) using industry codes on the company — not just revenue growth.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-3xl">
          <strong>Profiles</strong> and <strong>campaigns</strong> are stored in Postgres; enrichment batches create rows in{" "}
          <code className="text-[10px]">enrichment_runs</code> (recent runs for the selected campaign are listed below after you
          enrich).
        </p>
      </div>

      {!profilesLoading && profiles.length === 0 && !profilesLoadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">No screening profiles yet.</span>{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-primary"
            onClick={() => {
              setProfileEditorMode("new");
              setProfileEditorId(null);
              setProfileEditorOpen(true);
            }}
          >
            Create a profile
          </Button>{" "}
          to define Layer 1 scoring (variables, weights, archetypes), then run a campaign below.
        </div>
      ) : null}

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-lg font-medium">New campaign</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
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
              onChange={(e) =>
                setLayer0Limit(Number(e.target.value) || DEFAULT_LAYER0_CAP)
              }
            />
            <p className="text-[10px] text-muted-foreground">
              Default {DEFAULT_LAYER0_CAP} (max companies ranked after universe + exclusions).
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-sm">Exclude SNI / NACE prefixes (industry)</Label>
          <p className="text-xs text-muted-foreground">
            Companies with <em>any</em> code in <code className="text-xs">companies.nace_codes</code> starting
            with these digits are removed before ranking (typical Swedish SNI sections).
          </p>
          <div className="flex flex-wrap gap-3">
            {SNI_PREFIX_PRESETS.map(({ prefix, label }) => (
              <label
                key={prefix}
                className="flex items-start gap-2 text-sm cursor-pointer max-w-[280px]"
              >
                <input
                  type="checkbox"
                  className="mt-1 rounded border-input"
                  checked={excludedSniPrefixes.has(prefix)}
                  onChange={() => {
                    setExcludedSniPrefixes((prev) => {
                      const n = new Set(prev);
                      if (n.has(prefix)) n.delete(prefix);
                      else n.add(prefix);
                      return n;
                    });
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1 max-w-xl">
            <Label htmlFor="custom-sni" className="text-xs text-muted-foreground">
              Extra prefixes (comma-separated, 2–5 digits)
            </Label>
            <Input
              id="custom-sni"
              placeholder="e.g. 77, 841"
              value={customSniPrefixes}
              onChange={(e) => setCustomSniPrefixes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground max-w-xl">
            Saves the campaign and <strong className="text-foreground">runs Layer 0 immediately</strong> so the shortlist
            appears in the table — no extra click.
          </p>
          <Button
            variant="primary"
            className="shrink-0 w-full sm:w-auto min-h-10 px-6"
            onClick={() => void handleCreateAndRunLayer0()}
            disabled={busy || profilesLoading || !profileId || !!profilesLoadError || profiles.length === 0}
            title={runNewCampaignDisabledReason}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Run Layer 0
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-medium">Campaigns</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCampaigns()}
              disabled={campaignsLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          {campaignsLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading campaigns">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <ul className="space-y-1">
              {campaigns.map((c) => (
                <li key={c.id} className="flex gap-1 items-stretch">
                  <button
                    type="button"
                    className={`flex-1 min-w-0 text-left rounded-md px-3 py-2 text-sm transition-colors ${
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
                      {c.profileId
                        ? ` · ${profiles.find((p) => p.id === c.profileId)?.name ?? "Profile"}`
                        : ""}
                      {c.createdAt ? ` · ${formatShortDate(c.createdAt)}` : ""}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 px-2 text-destructive hover:text-destructive"
                    title="Delete campaign"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteCampaign(c.id, c.name);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Delete campaign</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {selectedId && selected ? (
            <Collapsible open={campaignResultsOpen} onOpenChange={setCampaignResultsOpen}>
              <CollapsibleTrigger
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      campaignResultsOpen ? "rotate-0" : "-rotate-90"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">Campaign results</span>
                </span>
                <span className="text-xs font-normal text-muted-foreground truncate max-w-[45%]">
                  {selected.name}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="rounded-md border border-border/80 bg-muted/10 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">Layer 0 (last run)</p>
                  <p className="text-muted-foreground">
                    {formatLayer0Summary(selected.statsJson?.layer0 as Record<string, unknown> | undefined)}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Enrichment runs (Postgres)</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        void listEnrichmentRuns({ campaignId: selected.id, limit: 15 }).then(setEnrichmentRuns);
                      }}
                      disabled={enrichmentRunsLoading}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${enrichmentRunsLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Clicking <strong>Enrich public data</strong> calls <code className="text-[9px]">POST /api/enrichment/run</code>{" "}
                    with this campaign&apos;s orgnrs (skips rows marked Skip). A row is stored in{" "}
                    <code className="text-[9px]">enrichment_runs</code>; outputs land in{" "}
                    <code className="text-[9px]">company_enrichment</code> and <code className="text-[9px]">ai_profiles</code>{" "}
                    (also visible on each company page).
                  </p>
                  {enrichmentRunsLoading && enrichmentRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading runs…</p>
                  ) : enrichmentRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No enrichment runs for this campaign yet. Run <strong>Enrich public data</strong> (right panel).
                    </p>
                  ) : (
                    <ul className="space-y-0 max-h-56 overflow-y-auto" aria-label="Enrichment runs for this campaign">
                      {enrichmentRuns.map((run) => {
                        const expanded = expandedEnrichmentRunId === run.runId;
                        const st = enrichmentStatusByRun[run.runId];
                        const loadingDetail = loadingEnrichmentDetailId === run.runId;
                        return (
                          <li
                            key={run.runId}
                            className="border-b border-border/60 last:border-0 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {run.runId.slice(0, 8)}…
                              </span>
                              <span className="text-muted-foreground">{formatShortDate(run.createdAt)}</span>
                              <span className="text-muted-foreground">
                                {run.queuedCount != null ? `${run.queuedCount} queued` : "—"}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] gap-1"
                                aria-expanded={expanded}
                                onClick={() => void toggleEnrichmentRunDetail(run.runId)}
                              >
                                {expanded ? (
                                  <ChevronDown className="h-3 w-3" aria-hidden />
                                ) : (
                                  <ChevronRight className="h-3 w-3" aria-hidden />
                                )}
                                Details
                              </Button>
                            </div>
                            {expanded ? (
                              <div className="pb-2 pl-1 text-muted-foreground border-l-2 border-border ml-1 space-y-1">
                                {loadingDetail ? (
                                  <p className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                    Loading status…
                                  </p>
                                ) : st ? (
                                  <>
                                    <p>
                                      <span className="text-foreground font-medium">Completed orgs:</span> {st.completed}
                                      {typeof st.pending === "number" && st.pending > 0 ? (
                                        <>
                                          {" "}
                                          · <span className="text-foreground font-medium">Pending:</span> {st.pending}
                                        </>
                                      ) : null}
                                      {" "}
                                      · <span className="text-foreground font-medium">Failed:</span> {st.failed}
                                    </p>
                                    <p>
                                      <span className="text-foreground font-medium">By kind:</span>{" "}
                                      {Object.keys(st.counts_by_kind).length
                                        ? Object.entries(st.counts_by_kind)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(", ")
                                        : "—"}
                                    </p>
                                    {st.failures?.length ? (
                                      <p className="text-destructive text-[11px] break-words">
                                        Failures: {JSON.stringify(st.failures.slice(0, 3))}
                                        {st.failures.length > 3 ? "…" : ""}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="text-destructive">Status unavailable.</p>
                                )}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">Run &amp; results</h2>
          {!selectedId || !selected ? (
            <p className="text-sm text-muted-foreground">Select a campaign to run Layer 0 and view rows.</p>
          ) : (
            <>
              <div className="space-y-2 rounded-md border border-border bg-muted/15 px-3 py-2">
                <Label htmlFor="campaign-rename" className="text-xs text-muted-foreground">
                  Campaign name
                </Label>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input
                    id="campaign-rename"
                    value={campaignRename}
                    onChange={(e) => setCampaignRename(e.target.value)}
                    className="max-w-md"
                    placeholder="Display name in list"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      busy ||
                      !campaignRename.trim() ||
                      campaignRename.trim() === selected.name
                    }
                    onClick={() => void handleRenameCampaign()}
                  >
                    Save name
                  </Button>
                </div>
              </div>
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
                  title={busy ? "Wait for the current operation to finish." : undefined}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Run Layer 0
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title={
                    enrichDisabledReason ??
                    "Queue website + LLM enrichment for non-skipped candidates (same pipeline as /api/enrichment/run)"
                  }
                  onClick={() => void handleEnrichPublic(selected.id)}
                  disabled={busy || candidatesTotal === 0}
                >
                  <Database className="w-4 h-4 mr-1" />
                  Enrich public data
                </Button>
              </div>

              <div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                <p>
                  <strong className="text-foreground">What happens:</strong> Non-skipped candidates are sent to the enrichment worker
                  (Redis queue, or synchronous fallback). Progress and counts for the run appear under{" "}
                  <strong>Campaign results</strong> on the left.
                </p>
                <p>
                  <strong className="text-foreground">Where it&apos;s stored:</strong>{" "}
                  <code className="text-[10px]">enrichment_runs</code> (batch),{" "}
                  <code className="text-[10px]">company_enrichment</code> (per org + kind),{" "}
                  <code className="text-[10px]">ai_profiles</code> (merged view used on the company page).
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Candidates: {candidatesTotal} (showing {candidates.length}). Click a name for the company profile, or{" "}
                <strong>Deep Research</strong> to start step 7 with org.nr pre-filled (manual run — you confirm in the wizard).
                Use <strong>Skip</strong> to mark rows to exclude from later stages (e.g. head office / holding).
              </p>
              <div
                className="rounded-md border overflow-x-auto"
                role="region"
                aria-label="Campaign candidates"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        scope="col"
                        className="w-10 text-center"
                        title="Exclude from further analysis"
                      >
                        Skip
                      </TableHead>
                      <TableHead scope="col" className="w-14">
                        #
                      </TableHead>
                      <TableHead scope="col">Org.nr</TableHead>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col" className="font-mono text-xs">
                        Primary SNI
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Profile score
                      </TableHead>
                      <TableHead scope="col">Archetype</TableHead>
                      <TableHead scope="col" className="min-w-[200px] max-w-[300px]">
                        Public enrichment
                      </TableHead>
                      <TableHead scope="col" className="w-[140px] text-right">
                        Deep Research
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-muted-foreground text-sm">
                          No rows yet. Run Layer 0.
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidates.map((r) => {
                        const excluded = Boolean(r.excludedFromAnalysis);
                        return (
                          <TableRow
                            key={r.orgnr}
                            className={excluded ? "opacity-70 bg-muted/40" : undefined}
                          >
                            <TableCell className="text-center align-middle">
                              <Checkbox
                                checked={excluded}
                                title="Exclude from further analysis"
                                aria-label={`Exclude ${r.name ?? r.orgnr} from further analysis`}
                                onCheckedChange={(v) => {
                                  const next = v === true;
                                  void handleToggleExclusion(
                                    selected.id,
                                    r.orgnr,
                                    next,
                                    excluded
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell>{r.layer0Rank ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              <Link
                                to={`/company/${r.orgnr}`}
                                className="text-primary hover:underline"
                              >
                                {r.orgnr}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <Link
                                  to={`/company/${r.orgnr}`}
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                >
                                  {r.name ?? "—"}
                                  <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                                </Link>
                                {r.exclusionReason ? (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                                    {r.exclusionReason}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {r.primaryNace ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.profileWeightedScore != null
                                ? r.profileWeightedScore.toFixed(4)
                                : "—"}
                            </TableCell>
                            <TableCell>{r.archetypeCode ?? "—"}</TableCell>
                            <TableCell className="align-top text-xs max-w-[300px]">
                              {(() => {
                                const kinds = r.enrichmentKinds ?? [];
                                const summary = r.enrichmentSummary;
                                const status = r.enrichmentStatus;
                                if (!kinds.length && !summary && !status) {
                                  return <span className="text-muted-foreground">—</span>;
                                }
                                return (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1 items-center">
                                      {kinds.map((k) => (
                                        <span
                                          key={k}
                                          className="inline-flex rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground"
                                        >
                                          {k}
                                        </span>
                                      ))}
                                      {status ? (
                                        <span
                                          className="text-[10px] text-muted-foreground"
                                          title="ai_profiles.enrichment_status"
                                        >
                                          {status}
                                        </span>
                                      ) : null}
                                    </div>
                                    {summary ? (
                                      <p
                                        className="text-[10px] text-muted-foreground line-clamp-3 leading-snug"
                                        title={summary}
                                      >
                                        {summary}
                                      </p>
                                    ) : kinds.length > 0 ? (
                                      <p className="text-[10px] text-muted-foreground italic">
                                        Kinds stored; summary fills when AI profile text is available.
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={excluded}
                                title={
                                  excluded
                                    ? "Un-skip this row to start Deep Research"
                                    : "Start Deep Research with this org.nr pre-filled"
                                }
                                aria-label={
                                  excluded
                                    ? "Deep Research disabled — un-skip row first"
                                    : `Deep Research for ${r.name ?? r.orgnr}`
                                }
                                onClick={() =>
                                  navigate(
                                    buildDeepResearchHandoffUrl(r.orgnr, {
                                      name: r.name,
                                      campaignName: selected?.name ?? null,
                                    })
                                  )
                                }
                              >
                                <FileSearch className="h-3.5 w-3.5" aria-hidden />
                                <span className="hidden sm:inline">Research</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
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
          setProfilesLoading(true);
          try {
            await loadProfiles();
            if (selectProfileId && savedId) setProfileId(savedId);
          } finally {
            setProfilesLoading(false);
          }
        }}
      />
    </div>
  );
}
