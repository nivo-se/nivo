import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  startScreeningLayer1,
  startScreeningLayer2,
  startScreeningLayer3,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ScreeningCampaignCandidate,
  ScreeningCampaignSummary,
} from "@/lib/api/screeningCampaigns/types";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/** Swedish SNI 2007 section prefixes — exclude haulage (49), finance/holdings (64), etc. */
const SNI_PREFIX_PRESETS: { prefix: string; label: string }[] = [
  { prefix: "49", label: "49 — Land transport (Åkeri, spedition…)" },
  { prefix: "64", label: "64 — Financial & holding (e.g. PE vehicles)" },
  { prefix: "66", label: "66 — Insurance & pension funds" },
  { prefix: "52", label: "52 — Warehousing & transport support" },
  { prefix: "55", label: "55 — Accommodation (hotels, camping…)" },
  { prefix: "70", label: "70 — Head offices / mgmt consulting" },
  { prefix: "77", label: "77 — Rental & leasing activities" },
  { prefix: "84", label: "84 — Public admin & defence" },
  { prefix: "85", label: "85 — Education" },
];

/** All preset SNI section prefixes enabled for new runs (user can uncheck in Industry exclusions). */
function defaultExcludedSniPrefixes(): Set<string> {
  return new Set(SNI_PREFIX_PRESETS.map((p) => p.prefix));
}

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

/** Human-readable stats from POST /screening/campaigns/:id/start (`layer0` payload). */
function formatScreeningRunSummary(layer0: Record<string, unknown> | undefined): string {
  if (!layer0 || typeof layer0 !== "object") {
    return "Screening run finished. The shortlist below was updated.";
  }
  const kept = layer0.kept;
  const total = layer0.total_matched;
  const limit = layer0.layer0_limit;
  const scanned = layer0.scanned_rows;
  const cohortMax = layer0.max_universe_candidates;
  const rankedCap = layer0.ranked_after_cohort_cap;
  const parts: string[] = [];
  if (typeof kept === "number") parts.push(`Kept ${kept} companies`);
  if (typeof total === "number") parts.push(`${total} matched the universe query`);
  if (typeof limit === "number") parts.push(`shortlist up to ${limit}`);
  if (typeof cohortMax === "number" && typeof rankedCap === "number") {
    parts.push(`ranked pool capped at ${rankedCap} (max ${cohortMax})`);
  }
  if (typeof scanned === "number") parts.push(`scanned ${scanned} rows`);
  if (parts.length === 0) return "Screening run finished. The shortlist below was updated.";
  return `${parts.join(" · ")}. Shortlist refreshed below.`;
}

/** One-line summary for GET /api/enrichment/run/:id/status (shown without opening Details). */
function formatEnrichmentRunStatusInline(st: EnrichmentRunStatus | undefined): string {
  if (!st) return "Loading status…";
  const kinds = Object.entries(st.counts_by_kind || {}).filter(([, v]) => v > 0);
  const kindStr = kinds.length ? ` · ${kinds.map(([k, v]) => `${k}: ${v}`).join(" · ")}` : "";
  return `${st.completed} saved · ${st.pending ?? 0} pending · ${st.failed} failed${kindStr}`;
}

/** Drives “recommended next” copy from screening_campaigns.current_stage (layer0 → layer3). */
function getScreeningNextStepGuide(stage: string | null | undefined): {
  headline: string;
  detail: string;
  /** Which control to emphasize: Layer 1–3 or enrich after layer3 */
  emphasize: "layer1" | "layer2" | "layer3" | "enrich" | null;
} {
  const s = (stage || "layer0").toLowerCase();
  if (s === "layer0")
    return {
      headline: "Recommended next: Layer 1",
      detail:
        "Your shortlist is ranked by the screening profile only. Run Layer 1 next: the model applies the investment playbook (screening_output.json) to every row — in mandate, out of mandate, or uncertain. Do not skip to Layer 2 or 3 before Layer 1 finishes.",
      emphasize: "layer1",
    };
  if (s === "layer1")
    return {
      headline: "Recommended next: Layer 2",
      detail:
        "Mandate labels are saved in the L1 column. Run Layer 2 next: a fit scorecard on companies that are in mandate or uncertain (per your policy). Layer 3 should run after Layer 2.",
      emphasize: "layer2",
    };
  if (s === "layer2")
    return {
      headline: "Recommended next: Layer 3",
      detail:
        "Fit scores are stored. Run Layer 3 next: it blends profile score and fit into a final rank and marks who is selected — fast, no extra LLM.",
      emphasize: "layer3",
    };
  if (s === "layer3")
    return {
      headline: "Screening pipeline complete",
      detail:
        "Layers 1–3 are done. Optionally run Enrich public data on this campaign to pull website and structured facts into company profiles before deep diligence. You can also open Deep Research from any row.",
      emphasize: "enrich",
    };
  return {
    headline: "Continue the screening pipeline",
    detail: "Run Layer 1, then Layer 2, then Layer 3 in that order. Use Enrich when you want richer company data.",
    emphasize: "layer1",
  };
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
  const [playbookGuideOpen, setPlaybookGuideOpen] = useState(true);

  const [name, setName] = useState("Universe screening");
  const [profileId, setProfileId] = useState("");
  const DEFAULT_LAYER0_CAP = 20;
  const DEFAULT_MAX_UNIVERSE = 500;
  const [layer0Limit, setLayer0Limit] = useState(DEFAULT_LAYER0_CAP);
  const [maxUniverseCandidates, setMaxUniverseCandidates] = useState(DEFAULT_MAX_UNIVERSE);
  /** Rename field for selected campaign */
  const [campaignRename, setCampaignRename] = useState("");
  /** SNI/NACE 2–5 digit prefixes to drop (any code on the company starting with one of these). */
  const [excludedSniPrefixes, setExcludedSniPrefixes] = useState<Set<string>>(defaultExcludedSniPrefixes);
  const [customSniPrefixes, setCustomSniPrefixes] = useState("");
  /** Structural SQL floors (SEK revenue, headcount) — merged into campaign filters. */
  const [minRevenueMsek, setMinRevenueMsek] = useState("");
  const [minEmployees, setMinEmployees] = useState("");

  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<"new" | "edit">("new");
  const [profileEditorId, setProfileEditorId] = useState<string | null>(null);
  const [enrichmentRuns, setEnrichmentRuns] = useState<EnrichmentRunSummary[]>([]);
  const [enrichmentRunsLoading, setEnrichmentRunsLoading] = useState(false);
  const [expandedEnrichmentRunId, setExpandedEnrichmentRunId] = useState<string | null>(null);
  const [enrichmentStatusByRun, setEnrichmentStatusByRun] = useState<Record<string, EnrichmentRunStatus>>({});
  const [loadingEnrichmentDetailId, setLoadingEnrichmentDetailId] = useState<string | null>(null);
  /** Collapsible scores & enrichment runs under the campaign list. */
  const [campaignResultsOpen, setCampaignResultsOpen] = useState(true);
  /** Industry / NACE exclusions — collapsed by default to reduce noise. */
  const [industryExclusionsOpen, setIndustryExclusionsOpen] = useState(false);
  const [structuralFiltersOpen, setStructuralFiltersOpen] = useState(false);
  /** Technical enrichment details — collapsed by default. */
  const [enrichmentHelpOpen, setEnrichmentHelpOpen] = useState(false);
  /** Latest "Enrich public data" run for the shortlist card — progress + verification. */
  const [enrichRunProgress, setEnrichRunProgress] = useState<{
    campaignId: string;
    runId: string;
    status: EnrichmentRunStatus | null;
    polling: boolean;
  } | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /** Clear enrichment banner when switching campaign or deselecting. */
  useEffect(() => {
    setEnrichRunProgress((prev) => {
      if (!selectedId) return null;
      if (prev && prev.campaignId !== selectedId) return null;
      return prev;
    });
  }, [selectedId]);

  /**
   * Keep rename input in sync when the selected campaign changes, or when the list first loads the row.
   * Do not reset on every `campaigns` refresh (same selection) — that wiped in-progress edits and caused no-op saves.
   */
  const renameSyncedForIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      setCampaignRename("");
      renameSyncedForIdRef.current = null;
      return;
    }
    const c = campaigns.find((x) => x.id === selectedId);
    if (!c) return;
    if (renameSyncedForIdRef.current === selectedId) return;
    setCampaignRename(c.name ?? "");
    renameSyncedForIdRef.current = selectedId;
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

  /** Stable key so we do not refetch status on unrelated re-renders. */
  const enrichmentRunIdsKey = enrichmentRuns.map((r) => r.runId).join("|");

  /** Prefetch status for visible runs (no need to open Details). */
  useEffect(() => {
    if (!selectedId || !enrichmentRunIdsKey) return;
    let cancelled = false;
    const ids = enrichmentRunIdsKey.split("|").slice(0, 8);
    void (async () => {
      await Promise.all(
        ids.map(async (id) => {
          try {
            const st = await getEnrichmentRunStatus(id);
            if (!cancelled && st) {
              setEnrichmentStatusByRun((prev) => ({ ...prev, [id]: st }));
            }
          } catch {
            /* ignore */
          }
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, enrichmentRunIdsKey]);

  const latestEnrichmentRunId = enrichmentRuns[0]?.runId;
  const latestEnrichmentStatus = latestEnrichmentRunId
    ? enrichmentStatusByRun[latestEnrichmentRunId]
    : undefined;

  const hasLatestEnrichmentStatus = latestEnrichmentStatus !== undefined;
  const latestPendingCount = latestEnrichmentStatus?.pending ?? 0;

  /** While the most recent run still has pending work, poll status so the list updates without Refresh. */
  useEffect(() => {
    if (!latestEnrichmentRunId || !hasLatestEnrichmentStatus) return;
    if (latestPendingCount <= 0) return;
    const iv = window.setInterval(() => {
      void getEnrichmentRunStatus(latestEnrichmentRunId).then((st) => {
        if (st) {
          setEnrichmentStatusByRun((prev) => ({ ...prev, [latestEnrichmentRunId]: st }));
        }
      });
    }, 4000);
    return () => window.clearInterval(iv);
  }, [latestEnrichmentRunId, hasLatestEnrichmentStatus, latestPendingCount]);

  function mergedSniExclusions(): string[] {
    const extra = customSniPrefixes
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([...excludedSniPrefixes, ...extra])];
  }

  /** Create campaign in Postgres, then run universe screening + rank (single primary action). */
  async function handleCreateAndRunScreening() {
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

      const structural: Array<{
        field: string;
        op: string;
        value: number;
        type: string;
      }> = [];
      const rev = Number(minRevenueMsek);
      if (Number.isFinite(rev) && rev > 0) {
        structural.push({
          field: "revenue_latest",
          op: ">=",
          value: rev * 1_000_000,
          type: "number",
        });
      }
      const emp = Number(minEmployees);
      if (Number.isFinite(emp) && emp > 0) {
        structural.push({
          field: "employees_latest",
          op: ">=",
          value: emp,
          type: "number",
        });
      }

      const { campaignId } = await createScreeningCampaign({
        name,
        profileId,
        params: { layer0Limit, maxUniverseCandidates },
        filters: [...naceFilters, ...structural],
      });
      await loadCampaigns();
      setSelectedId(campaignId);

      const result = await startScreeningCampaign(campaignId);
      const layer0 = result.layer0 as Record<string, unknown> | undefined;
      toast({
        title: "Screening complete",
        description: formatScreeningRunSummary(layer0),
      });
      await loadCandidates(campaignId);
      await loadCampaigns();
    } catch (e) {
      toast({
        title: "Screening run failed",
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

  async function handleLayer1Run() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const out = await startScreeningLayer1(selectedId);
      const st = out.layer1 as Record<string, unknown> | undefined;
      toast({
        title: "Layer 1 relevance complete",
        description:
          typeof st?.processed === "number"
            ? `Labeled ${st.processed} companies (batched).`
            : "Shortlist updated with relevance labels.",
      });
      await loadCandidates(selectedId);
      await loadCampaigns();
    } catch (e) {
      toast({
        title: "Layer 1 failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLayer2Run() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const out = await startScreeningLayer2(selectedId);
      const st = out.layer2 as Record<string, unknown> | undefined;
      toast({
        title: "Layer 2 fit complete",
        description:
          typeof st?.processed === "number"
            ? `Scored ${st.processed} in-mandate / uncertain rows.`
            : "Fit scorecards written.",
      });
      await loadCandidates(selectedId);
      await loadCampaigns();
    } catch (e) {
      toast({
        title: "Layer 2 failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLayer3Run() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const out = await startScreeningLayer3(selectedId);
      const st = out.layer3 as Record<string, unknown> | undefined;
      toast({
        title: "Layer 3 blend complete",
        description:
          typeof st?.ranked === "number"
            ? `Ranked ${st.ranked} rows by combined score.`
            : "Final ranks updated.",
      });
      await loadCandidates(selectedId);
      await loadCampaigns();
    } catch (e) {
      toast({
        title: "Layer 3 failed",
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

  async function pollEnrichmentRun(campaignId: string, runId: string) {
    const maxRounds = 45;
    for (let i = 0; i < maxRounds; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000));
      let st: EnrichmentRunStatus | null = null;
      try {
        st = await getEnrichmentRunStatus(runId);
      } catch {
        /* ignore */
      }
      if (st) {
        setEnrichmentStatusByRun((prev) => ({ ...prev, [runId]: st }));
        setEnrichRunProgress((prev) =>
          prev?.runId === runId && prev.campaignId === campaignId
            ? { ...prev, status: st, polling: true }
            : prev
        );
      }
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
      if (st && st.pending === 0) {
        setEnrichRunProgress((prev) =>
          prev?.runId === runId && prev.campaignId === campaignId
            ? { ...prev, status: st, polling: false }
            : prev
        );
        const kindSummary = Object.entries(st.counts_by_kind || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        toast({
          title: "Enrichment run finished",
          description:
            `${st.completed} companies with saved enrichment${st.failed ? `, ${st.failed} failed or skipped` : ""}` +
            (kindSummary ? `. ${kindSummary}` : "") +
            ". See the Public enrichment column in the table below.",
        });
        return;
      }
    }
    setEnrichRunProgress((prev) =>
      prev?.runId === runId && prev.campaignId === campaignId
        ? { ...prev, polling: false }
        : prev
    );
    toast({
      title: "Enrichment still running or status unavailable",
      description:
        "If nothing was saved, the job may be stuck in Redis without an RQ worker. Set ENRICHMENT_DEFAULT_SYNC_RUN=true on the API or VITE_ENRICHMENT_SYNC_RUN=true on the frontend, restart, and run Enrich again. You can also check Scores and enrichment runs on the campaign.",
    });
  }

  async function handleEnrichPublic(campaignId: string) {
    setBusy(true);
    let runId = "";
    try {
      const out = await runEnrichmentForScreeningCampaign(campaignId);
      runId = out.runId;
      setCampaignResultsOpen(true);
      setExpandedEnrichmentRunId(runId);
      setEnrichRunProgress({
        campaignId,
        runId,
        status: null,
        polling: true,
      });
      toast({
        title: "Enrichment queued",
        description: `Run ${runId.slice(0, 8)}… — ${out.queuedCount} companies. Status updates below.`,
      });
      setEnrichmentRuns(await listEnrichmentRuns({ campaignId, limit: 15 }));
      try {
        const st0 = await getEnrichmentRunStatus(runId);
        if (st0) {
          setEnrichmentStatusByRun((prev) => ({ ...prev, [runId]: st0 }));
          setEnrichRunProgress({
            campaignId,
            runId,
            status: st0,
            polling: true,
          });
        }
      } catch {
        /* status optional on first tick */
      }
      if (selectedIdRef.current === campaignId) {
        try {
          await loadCandidates(campaignId);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setEnrichRunProgress(null);
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
    void pollEnrichmentRun(campaignId, runId);
  }

  const selected = campaigns.find((c) => c.id === selectedId);

  const nextPipelineGuide = useMemo(
    () => (selected ? getScreeningNextStepGuide(selected.currentStage) : null),
    [selected]
  );

  /** Rows in the shortlist table that have any public enrichment / ai_profiles snippet loaded. */
  const publicEnrichmentRowCount = useMemo(() => {
    if (!candidates.length) return 0;
    return candidates.filter(
      (c) =>
        (c.enrichmentKinds?.length ?? 0) > 0 ||
        (typeof c.enrichmentSummary === "string" && c.enrichmentSummary.trim().length > 0) ||
        Boolean(c.enrichmentStatus && String(c.enrichmentStatus).trim())
    ).length;
  }, [candidates]);

  /** Inline feedback after “Enrich public data” — run id, counts, table rows with data. */
  const enrichProgressBanner = useMemo(() => {
    if (!selected || !enrichRunProgress || enrichRunProgress.campaignId !== selected.id) {
      return null;
    }
    const erp = enrichRunProgress;
    const st = erp.status;
    const pending = st?.pending ?? 0;
    const enrichFinished = Boolean(st && pending === 0);
    const enrichStalled = !erp.polling && Boolean(st && pending > 0);
    const kindParts = st ? Object.entries(st.counts_by_kind || {}).filter(([, v]) => v > 0) : [];
    return (
      <Alert
        className={cn(
          "mt-2 border-primary/25 bg-primary/[0.06]",
          enrichFinished && "border-emerald-500/35 bg-emerald-500/[0.07]",
          enrichStalled && "border-amber-500/35 bg-amber-500/[0.06]"
        )}
      >
        {enrichFinished ? (
          <CheckCircle2
            className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : erp.polling ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
        ) : (
          <AlertCircle
            className="h-4 w-4 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
        )}
        <AlertTitle className="text-foreground">
          {enrichFinished
            ? "Enrichment run complete"
            : erp.polling
              ? "Enrichment in progress"
              : "Enrichment status"}
        </AlertTitle>
        <AlertDescription className="space-y-2 text-muted-foreground">
          <p>
            Run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              {erp.runId.slice(0, 8)}…
            </code>
            {st ? (
              <>
                {" "}
                — <strong className="text-foreground">{st.completed}</strong> saved
                {st.failed ? (
                  <>
                    , <strong className="text-foreground">{st.failed}</strong> failed
                  </>
                ) : null}
                {pending > 0 ? (
                  <>
                    , <strong className="text-foreground">{pending}</strong> still processing
                  </>
                ) : null}
              </>
            ) : erp.polling ? (
              " — waiting for worker status…"
            ) : (
              " — full status was not available; check Scores & enrichment runs."
            )}
          </p>
          {kindParts.length > 0 ? (
            <p className="text-[11px] leading-relaxed">
              {kindParts.map(([k, v]) => (
                <span key={k} className="mr-2 inline-block">
                  <strong className="text-foreground">{k}</strong>: {v}
                </span>
              ))}
            </p>
          ) : null}
          {st && erp.polling && pending > 0 && st.completed === 0 ? (
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/90">
              If this never saves rows, Redis may have queued the job without a worker. Use synchronous enrichment
              (see <code className="rounded bg-muted px-1 font-mono text-[10px]">ENRICHMENT_DEFAULT_SYNC_RUN</code> on
              the API or <code className="rounded bg-muted px-1 font-mono text-[10px]">VITE_ENRICHMENT_SYNC_RUN</code>{" "}
              in the frontend env), restart, and run Enrich again.
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed">
            <strong className="text-foreground">{publicEnrichmentRowCount}</strong> of {candidates.length}{" "}
            visible rows have data in <strong className="text-foreground">Public enrichment</strong> (updates as rows
            finish).
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setEnrichRunProgress(null)}
          >
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    );
  }, [selected, enrichRunProgress, publicEnrichmentRowCount, candidates.length]);

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
        ? "This campaign has no candidates yet — use New campaign above to run screening, or select a campaign that already has candidates."
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
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
            Screening profiles failed to load: {profilesLoadError}. You need at least one profile to start a run.
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
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Screening</h1>
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Build a ranked shortlist from the universe using a <strong className="text-foreground font-medium">screening profile</strong>,
              then enrich companies for deeper review. Optional industry filters drop whole sectors (e.g. transport, holdings)
              before scoring.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link to="/screening-campaigns/exemplars">Playbook &amp; examples</Link>
          </Button>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3 rounded-xl border border-border/80 bg-muted/25 px-4 py-3 text-sm text-muted-foreground sm:gap-4">
          <li className="flex gap-2 sm:flex-col sm:gap-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
              1
            </span>
            <span>
              <span className="font-medium text-foreground">Configure</span> — name, profile, shortlist size, ranked pool cap, optional industry exclusions.
            </span>
          </li>
          <li className="flex gap-2 sm:flex-col sm:gap-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
              2
            </span>
            <span>
              <span className="font-medium text-foreground">Run screening</span> — creates the campaign and fills the shortlist in one step.
            </span>
          </li>
          <li className="flex gap-2 sm:flex-col sm:gap-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
              3
            </span>
            <span>
              <span className="font-medium text-foreground">Enrich</span> — optional public / LLM pass, then open companies or Deep Research.
            </span>
          </li>
        </ol>

        <Collapsible
          open={playbookGuideOpen}
          onOpenChange={setPlaybookGuideOpen}
          className="rounded-xl border border-border/80 bg-muted/20"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40 rounded-xl">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Use the playbook JSON as “what we look for” (Layer 1)
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                playbookGuideOpen && "rotate-180"
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 border-t border-border/60 px-4 pb-4 pt-0 text-sm text-muted-foreground">
            <Alert className="border-border/80 bg-background/80">
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="text-foreground">How it works today</AlertTitle>
              <AlertDescription className="space-y-2 text-muted-foreground [&_strong]:text-foreground">
                <p>
                  The file <strong>screening_output.json</strong> (see{" "}
                  <Link
                    to="/screening-campaigns/exemplars"
                    className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                  >
                    Playbook &amp; examples
                  </Link>
                  ) is <strong>not</strong> used to scan the entire database in one go. Instead:
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    <strong>Run screening</strong> runs <strong>Layer 0</strong>: SQL on the universe + your filters,
                    then ranks by the <strong>screening profile</strong> (weights and variables). It stores up to{" "}
                    <strong>Shortlist size</strong> companies in this campaign. This step is fast and does not send the
                    playbook to the LLM.
                  </li>
                  <li>
                    Click <strong>Layer 1</strong> to run the LLM with the playbook as “what we are looking for”. It
                    labels each row in your shortlist (in mandate / out / uncertain). That is the step that uses the JSON
                    as your investment mandate.
                  </li>
                  <li>
                    <strong>Layer 2</strong> and <strong>Layer 3</strong> refine fit and final ranking on the rows you
                    keep.
                  </li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2.5 text-xs leading-relaxed">
              <p className="font-medium text-foreground">Want a wide pool, then a strict playbook pass?</p>
              <p className="mt-1">
                Increase <strong className="text-foreground">Ranked pool cap</strong> and{" "}
                <strong className="text-foreground">Shortlist size</strong> above (e.g. hundreds) so Layer 0 keeps more
                companies from the universe. Then run <strong className="text-foreground">Layer 1</strong>. Layer 1 only
                sees companies already in this campaign&apos;s shortlist — not every row in Postgres in one shot.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </header>

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
          to define how companies are scored (variables, weights, archetypes), then run a campaign below.
        </div>
      ) : null}

      <Card className="shadow-sm hover:shadow-sm">
        <CardHeader className="space-y-1 pb-2 sm:pb-4">
          <CardTitle className="text-lg">Start a run</CardTitle>
          <CardDescription>
            Pick a screening profile and how many companies to keep. By default, all industry exclusions below are on — expand to adjust.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
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
            <Label htmlFor="camp-limit">Shortlist size</Label>
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
              Default {DEFAULT_LAYER0_CAP} (rows stored in this campaign after screening).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="camp-cohort-max">Ranked pool cap</Label>
            <Input
              id="camp-cohort-max"
              type="number"
              min={1}
              max={50000}
              value={maxUniverseCandidates}
              onChange={(e) =>
                setMaxUniverseCandidates(Number(e.target.value) || DEFAULT_MAX_UNIVERSE)
              }
            />
            <p className="text-[10px] text-muted-foreground">
              After sorting by profile score, consider at most this many rows (default {DEFAULT_MAX_UNIVERSE}). Must be ≥ shortlist size.
            </p>
          </div>
        </div>

        <Collapsible open={industryExclusionsOpen} onOpenChange={setIndustryExclusionsOpen}>
          <CollapsibleTrigger
            aria-expanded={industryExclusionsOpen}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/30"
          >
            <span>Industry exclusions</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                industryExclusionsOpen ? "rotate-0" : "-rotate-90"
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drop companies whose industry codes start with these prefixes (Swedish SNI / NACE). By default, every option below
              is enabled; uncheck any sector you want to keep in the universe.
            </p>
            <div className="flex flex-wrap gap-3">
              {SNI_PREFIX_PRESETS.map(({ prefix, label }) => (
                <label
                  key={prefix}
                  className="flex max-w-[280px] cursor-pointer items-start gap-2 text-sm"
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
            <div className="max-w-xl space-y-1">
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
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={structuralFiltersOpen} onOpenChange={setStructuralFiltersOpen}>
          <CollapsibleTrigger
            aria-expanded={structuralFiltersOpen}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/30"
          >
            <span>Structural floors (optional)</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                structuralFiltersOpen ? "rotate-0" : "-rotate-90"
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Applied as SQL filters on coverage metrics before ranking: minimum revenue (latest fiscal, SEK) and minimum
              employees. Revenue is entered in <strong className="text-foreground">MSEK</strong> (converted to SEK for the
              API).
            </p>
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div className="space-y-1">
                <Label htmlFor="min-rev-msek" className="text-xs">
                  Min revenue (MSEK)
                </Label>
                <Input
                  id="min-rev-msek"
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="e.g. 50"
                  value={minRevenueMsek}
                  onChange={(e) => setMinRevenueMsek(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="min-emp" className="text-xs">
                  Min employees
                </Label>
                <Input
                  id="min-emp"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 10"
                  value={minEmployees}
                  onChange={(e) => setMinEmployees(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs text-muted-foreground leading-relaxed">
            Creates your campaign and runs screening in one step. Your shortlist appears in the table on the right when it
            finishes.
          </p>
          <Button
            variant="primary"
            className="min-h-10 w-full shrink-0 px-6 sm:w-auto"
            onClick={() => void handleCreateAndRunScreening()}
            disabled={busy || profilesLoading || !profileId || !!profilesLoadError || profiles.length === 0}
            title={runNewCampaignDisabledReason}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Run screening
          </Button>
        </div>
        </CardContent>
      </Card>

      <section className="flex min-w-0 flex-col gap-6">
        <Card className="min-w-0 w-full shadow-sm hover:shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Your campaigns</CardTitle>
              <CardDescription className="mt-1">Select one to view the shortlist and enrichment.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCampaigns()}
              disabled={campaignsLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
          {campaignsLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading campaigns">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No campaigns yet. Use <strong className="text-foreground">Start a run</strong> above to create your first shortlist.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {campaigns.map((c) => (
                <li key={c.id} className="flex gap-1 items-stretch">
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selectedId === c.id
                        ? "border-primary/40 bg-primary/5 font-medium text-foreground shadow-sm"
                        : "border-transparent hover:bg-muted/60"
                    )}
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
                aria-expanded={campaignResultsOpen}
                className="flex w-full items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        campaignResultsOpen ? "rotate-0" : "-rotate-90"
                      )}
                      aria-hidden
                    />
                    <span className="truncate">Scores &amp; enrichment runs</span>
                  </span>
                  {enrichmentRunsLoading && enrichmentRuns.length === 0 ? (
                    <span className="pl-6 text-[11px] font-normal text-muted-foreground">
                      Loading enrichment history…
                    </span>
                  ) : enrichmentRuns[0] ? (
                    <span
                      className="pl-6 text-[11px] font-normal leading-snug text-muted-foreground"
                      title="Latest batch enrichment run for this campaign (Postgres enrichment_runs)"
                    >
                      Latest enrichment: {formatShortDate(enrichmentRuns[0].createdAt)} ·{" "}
                      {enrichmentRuns[0].queuedCount != null
                        ? `${enrichmentRuns[0].queuedCount} queued · `
                        : ""}
                      {formatEnrichmentRunStatusInline(latestEnrichmentStatus)}
                    </span>
                  ) : (
                    <span className="pl-6 text-[11px] font-normal text-muted-foreground">
                      No enrichment runs yet for this campaign.
                    </span>
                  )}
                </span>
                <span className="text-xs font-normal text-muted-foreground truncate max-w-[40%] sm:max-w-[45%]">
                  {selected.name}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="rounded-md border border-border/80 bg-muted/10 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">Last screening run</p>
                  <p className="text-muted-foreground">
                    {formatScreeningRunSummary(selected.statsJson?.layer0 as Record<string, unknown> | undefined)}
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
                  {latestEnrichmentStatus &&
                  latestEnrichmentStatus.pending > 0 &&
                  latestEnrichmentStatus.completed === 0 ? (
                    <p className="rounded border border-amber-500/25 bg-amber-500/[0.06] px-2 py-1.5 text-[10px] leading-snug text-amber-950 dark:text-amber-100">
                      <strong className="font-medium">0 saved</strong> with everything still{" "}
                      <strong className="font-medium">pending</strong> usually means <strong className="font-medium">no RQ worker</strong> is
                      processing the queue (Docker: start the <code className="text-[9px]">worker</code> service; local dev:{" "}
                      <code className="text-[9px]">scripts/start-worker.sh</code>). Or the worker is still running / orgs were skipped
                      (existing <code className="text-[9px]">ai_profiles</code>). Emergency: set{" "}
                      <code className="text-[9px]">VITE_ENRICHMENT_SYNC_RUN=true</code> to run in the API (slow).
                    </p>
                  ) : null}
                  {enrichmentRunsLoading && enrichmentRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading runs…</p>
                  ) : enrichmentRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No enrichment runs for this campaign yet. Run <strong>Enrich public data</strong> in the shortlist section below.
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
                            <p
                              className="pb-1.5 pl-0.5 text-[10px] leading-snug text-muted-foreground"
                              title="GET /api/enrichment/run/:runId/status — counts from company_enrichment and run meta"
                            >
                              <span className="text-foreground/80">Status:</span>{" "}
                              {formatEnrichmentRunStatusInline(st)}
                            </p>
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
          </CardContent>
        </Card>

        <Card className="min-w-0 w-full min-h-[280px] shadow-sm hover:shadow-sm">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-lg">Shortlist &amp; next steps</CardTitle>
            <CardDescription>
              Run <strong className="text-foreground font-medium">Layer 1 → 2 → 3</strong> in order (playbook, then fit, then final rank).{" "}
              <strong className="text-foreground font-medium">Enrich public data</strong> is separate — optional, for pulling facts into profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 pt-0">
          {!selectedId || !selected ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a campaign above, or start a new run at the top. Your table of companies will show here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-border bg-muted/15 px-3 py-3">
                <Label htmlFor="campaign-rename" className="text-xs font-medium text-foreground">
                  Rename (optional)
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

              {nextPipelineGuide ? (
                <Alert className="border-primary/25 bg-primary/[0.06]">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  <AlertTitle className="text-foreground">{nextPipelineGuide.headline}</AlertTitle>
                  <AlertDescription className="text-muted-foreground [&_strong]:text-foreground">
                    {nextPipelineGuide.detail}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
                    {selected.status}
                  </span>
                  {selected.currentStage ? (
                    <span
                      className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs font-mono text-muted-foreground"
                      title="Last completed screening stage"
                    >
                      Stage: {selected.currentStage}
                    </span>
                  ) : null}
                  {selected.errorMessage ? (
                    <span className="text-sm text-destructive truncate max-w-md">
                      {selected.errorMessage}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  LLM pipeline — run in order
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
                  <Button
                    variant={nextPipelineGuide?.emphasize === "layer1" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full sm:w-auto"
                    title="LLM relevance vs exemplar mandate (uses OPENAI_API_KEY / LLM_BASE_URL)"
                    onClick={() => void handleLayer1Run()}
                    disabled={busy || candidatesTotal === 0}
                  >
                    1 · Layer 1 — Playbook
                  </Button>
                  <Button
                    variant={nextPipelineGuide?.emphasize === "layer2" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full sm:w-auto"
                    title="Fit scorecard on in-mandate / uncertain rows"
                    onClick={() => void handleLayer2Run()}
                    disabled={busy || candidatesTotal === 0}
                  >
                    2 · Layer 2 — Fit
                  </Button>
                  <Button
                    variant={nextPipelineGuide?.emphasize === "layer3" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full sm:w-auto"
                    title="Deterministic blend + final rank"
                    onClick={() => void handleLayer3Run()}
                    disabled={busy || candidatesTotal === 0}
                  >
                    3 · Layer 3 — Final rank
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Optional — not part of the numbered pipeline
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enrichment fetches public / web data into profiles. You can run it <strong className="text-foreground font-medium">before</strong> Layer 1
                  to improve short blurbs the model sees, or <strong className="text-foreground font-medium">after</strong> Layer 3 on the names you care about.
                </p>
                <Button
                  variant={nextPipelineGuide?.emphasize === "enrich" ? "primary" : "outline"}
                  size="sm"
                  className="w-full sm:w-auto"
                  title={
                    enrichDisabledReason ??
                    "Queue website + LLM enrichment for candidates not marked Skip"
                  }
                  onClick={() => void handleEnrichPublic(selected.id)}
                  disabled={busy || candidatesTotal === 0}
                >
                  <Database className="w-4 h-4 mr-1" />
                  Enrich public data
                </Button>

                {enrichProgressBanner}
              </div>

              <Collapsible open={enrichmentHelpOpen} onOpenChange={setEnrichmentHelpOpen}>
                <CollapsibleTrigger
                  aria-expanded={enrichmentHelpOpen}
                  className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>How enrichment works</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      enrichmentHelpOpen ? "rotate-0" : "-rotate-90"
                    )}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  <p>
                    Non-skipped rows are sent to the enrichment worker (queue or sync). After you click Enrich, a status banner appears here with run id, per-kind counts, and how many table rows already show public data. Full history lives under{" "}
                    <strong className="text-foreground">Scores &amp; enrichment runs</strong> for your campaign.
                  </p>
                  <p>
                    Data is stored in <code className="rounded bg-muted px-1 py-0.5 text-[10px]">enrichment_runs</code>,{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">company_enrichment</code>, and{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">ai_profiles</code> — also visible on company pages.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{candidatesTotal}</strong> companies in this shortlist
                {candidates.length < candidatesTotal ? ` (showing first ${candidates.length})` : ""}. Open a row for the company
                profile, use <strong className="text-foreground">Skip</strong> to exclude from later steps, or{" "}
                <strong className="text-foreground">Research</strong> for Deep Research with org.nr pre-filled.
              </p>
              <div
                className="min-w-0 max-w-full overflow-x-auto rounded-md border [&_th]:h-10 [&_th]:px-2 [&_th]:py-2 [&_td]:p-2"
                role="region"
                aria-label="Campaign candidates"
              >
                <Table className="w-full min-w-[880px] table-fixed text-xs [&_th]:text-xs">
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-11" />
                    <col className="w-[6rem]" />
                    <col className="w-[11rem]" />
                    <col className="w-[5.25rem]" />
                    <col className="w-[4.5rem]" />
                    <col className="w-[5.5rem]" />
                    <col className="w-[5.5rem]" />
                    <col className="w-[4rem]" />
                    <col className="w-[12rem]" />
                    <col className="w-[7.5rem]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        scope="col"
                        className="w-10 text-center"
                        title="Exclude from further analysis"
                      >
                        Skip
                      </TableHead>
                      <TableHead
                        scope="col"
                        className="w-11"
                        title="Layer 0 rank within this shortlist (1 = best match)"
                      >
                        L0
                      </TableHead>
                      <TableHead scope="col" className="font-mono">
                        Org.nr
                      </TableHead>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col" className="font-mono">
                        Primary SNI
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Profile score
                      </TableHead>
                      <TableHead scope="col">Archetype</TableHead>
                      <TableHead scope="col" title="Layer 1 relevance (LLM)">
                        L1
                      </TableHead>
                      <TableHead scope="col" className="text-right" title="Layer 3 final rank after blend">
                        L3
                      </TableHead>
                      <TableHead scope="col">Public enrichment</TableHead>
                      <TableHead scope="col" className="text-right">
                        Deep Research
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-muted-foreground text-sm">
                          No rows yet. Use{" "}
                          <strong className="text-foreground">New campaign</strong> above and <strong className="text-foreground">Run screening</strong>.
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
                            <TableCell className="text-center align-middle [&:has([role=checkbox])]:pr-0">
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
                            <TableCell className="max-w-0">
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <Link
                                  to={`/company/${r.orgnr}`}
                                  className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
                                  title={r.name ?? undefined}
                                >
                                  <span className="truncate">{r.name ?? "—"}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                </Link>
                                {r.exclusionReason ? (
                                  <span className="max-w-full truncate text-[10px] text-muted-foreground">
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
                            <TableCell className="text-[10px] text-muted-foreground">
                              {r.relevanceStatus === "in_mandate"
                                ? "in"
                                : r.relevanceStatus === "out_of_mandate"
                                  ? "out"
                                  : r.relevanceStatus === "uncertain"
                                    ? "?"
                                    : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px]">
                              {r.finalRank != null ? r.finalRank : "—"}
                            </TableCell>
                            <TableCell className="max-w-0 align-top text-xs">
                              {(() => {
                                const kinds = r.enrichmentKinds ?? [];
                                const summary = r.enrichmentSummary;
                                const status = r.enrichmentStatus;
                                if (!kinds.length && !summary && !status) {
                                  return <span className="text-muted-foreground">—</span>;
                                }
                                return (
                                  <div className="min-w-0 space-y-1">
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
          </CardContent>
        </Card>
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
