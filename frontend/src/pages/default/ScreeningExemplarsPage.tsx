import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { getExemplarChunks, getExemplarMandate } from "@/lib/api/screeningExemplars/service";
import type { ExemplarMandateResponse } from "@/lib/api/screeningExemplars/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Info,
  Loader2,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";

/** Human-readable labels for keys in screening_output.json */
const SECTION_LABELS: Record<string, string> = {
  common_patterns: "Common patterns",
  archetypes: "Archetypes",
  investment_playbook: "Investment playbook",
};

function labelForKey(key: string): string {
  return SECTION_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ScreeningExemplarsPage() {
  const [mandate, setMandate] = useState<ExemplarMandateResponse | null>(null);
  const [mandateError, setMandateError] = useState<string | null>(null);
  const [mandateLoading, setMandateLoading] = useState(true);
  const [playbookJsonOpen, setPlaybookJsonOpen] = useState(false);

  const [orgnr, setOrgnr] = useState("");
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState<string | null>(null);
  const [chunksErrorTechnical, setChunksErrorTechnical] = useState<string | null>(null);
  const [chunksData, setChunksData] = useState<Awaited<
    ReturnType<typeof getExemplarChunks>
  > | null>(null);

  const loadMandate = useCallback(async () => {
    setMandateLoading(true);
    setMandateError(null);
    try {
      const data = await getExemplarMandate({ includeBody: true });
      setMandate(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load playbook";
      setMandateError(msg);
      setMandate(null);
    } finally {
      setMandateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMandate();
  }, [loadMandate]);

  const sectionSummary = useMemo(() => {
    if (!mandate?.keys?.length) return null;
    return mandate.keys.map((k) => labelForKey(k)).join(" · ");
  }, [mandate?.keys]);

  async function handleSearchExamples() {
    const o = orgnr.replace(/\D/g, "").trim();
    if (o.length < 6) {
      toast({
        title: "Add a company number",
        description:
          "Use at least 6 digits. Copy an org.nr from your screening shortlist on the campaigns page.",
        variant: "destructive",
      });
      return;
    }
    setChunksLoading(true);
    setChunksError(null);
    setChunksErrorTechnical(null);
    setChunksData(null);
    try {
      const data = await getExemplarChunks(o, 100);
      setChunksData(data);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setChunksErrorTechnical(raw);
      if (raw.includes("503") || raw.toLowerCase().includes("exemplar_report_chunks")) {
        setChunksError(
          "Example texts are not available on this server yet. An administrator needs to run the database migration and indexing script first."
        );
      } else {
        setChunksError(
          "Something went wrong. Check that you are logged in and the API is running."
        );
      }
    } finally {
      setChunksLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-16">
      <BackendStatusBanner />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
            <Link to="/screening-campaigns">← Back to screening campaigns</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Screening playbook &amp; examples
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            See <strong className="text-foreground font-medium">what the AI uses</strong> when it scores
            companies in screening (first pass and fit). The second section is optional: only teams that
            have stored example reports in the database will see text there.
          </p>
        </div>
      </div>

      <Alert className="border-border/80 bg-muted/30">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>What to do on this page</AlertTitle>
        <AlertDescription className="text-muted-foreground [&_p]:mt-2 [&_p:first-child]:mt-0">
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-foreground/90">
            <li>
              <strong className="font-medium text-foreground">Check the playbook below</strong> — it updates
              when the server loads (no indexing step). Confirm the version and open the full text if needed.
            </li>
            <li>
              <strong className="font-medium text-foreground">Example report snippets (optional)</strong> —
              only after an admin has run the indexer (see bottom of this page). Then you can paste an org.nr
              and search.
            </li>
          </ol>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                The screening playbook
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                Nivo loads this from the product repository. It shapes how the model thinks about relevance and
                fit — not your campaign settings, but the shared “what we like” patterns.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadMandate()} disabled={mandateLoading}>
              {mandateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mandateLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading playbook…
            </div>
          ) : mandateError ? (
            <p className="text-sm text-destructive">{mandateError}</p>
          ) : mandate ? (
            <>
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Active version</p>
                <p className="mt-1 font-mono text-lg text-foreground">{mandate.version ?? "—"}</p>
                {sectionSummary ? (
                  <p className="mt-2 text-muted-foreground">
                    <span className="text-foreground/80">Includes: </span>
                    {sectionSummary}
                  </p>
                ) : null}
                <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground leading-relaxed">
                  This playbook is read from the product repo when the API serves this page — you do{" "}
                  <strong className="text-foreground">not</strong> run a script to &quot;index&quot; it. Only the
                  optional example-report section below needs a one-time indexing command on the server.
                </p>
              </div>

              <Collapsible open={playbookJsonOpen} onOpenChange={setPlaybookJsonOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium text-foreground hover:underline">
                  {playbookJsonOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  Show full playbook (technical JSON)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1">
                  <p className="mb-2 text-xs text-muted-foreground">
                    For engineers and power users. Same structure as in the repo file{" "}
                    <code className="rounded bg-muted px-1 py-0.5">screening_output.json</code>
                    {mandate.path ? (
                      <>
                        {" "}
                        — on disk:{" "}
                        <span className="break-all font-mono text-[11px]">{mandate.path}</span>
                      </>
                    ) : null}
                    .
                  </p>
                  <pre
                    className={cn(
                      "max-h-[min(28rem,55vh)] overflow-auto rounded-lg border border-border bg-muted/40 p-3",
                      "text-xs leading-relaxed text-foreground"
                    )}
                  >
                    {mandate.body
                      ? JSON.stringify(mandate.body, null, 2)
                      : "Full playbook text is not available from this API yet. Ask your team to deploy the latest backend, or open screening_output.json in the repo."}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Example report text (optional)
          </CardTitle>
          <CardDescription className="max-w-2xl">
            If your team has run the indexer, stored snippets appear here by company number. If you have not
            set this up, searches will return nothing — that is normal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="exemplar-orgnr">Company org.nr</Label>
              <Input
                id="exemplar-orgnr"
                value={orgnr}
                onChange={(e) => setOrgnr(e.target.value)}
                placeholder="e.g. 5561234567"
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearchExamples();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Tip: open{" "}
                <Link
                  to="/screening-campaigns"
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Screening campaigns
                </Link>{" "}
                and copy an org.nr from your shortlist.
              </p>
            </div>
            <Button
              variant="primary"
              type="button"
              className="shrink-0"
              onClick={() => void handleSearchExamples()}
              disabled={chunksLoading}
            >
              {chunksLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {chunksError ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Could not load examples</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{chunksError}</p>
                {chunksErrorTechnical ? (
                  <details className="text-xs opacity-90">
                    <summary className="cursor-pointer">Technical details</summary>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background/50 p-2">
                      {chunksErrorTechnical}
                    </pre>
                  </details>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {!chunksData && !chunksError && !chunksLoading ? (
            <div className="flex gap-3 rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p>
                Enter a company number and click <strong className="text-foreground">Search</strong> to see if
                any indexed example text exists for that org.nr.
              </p>
            </div>
          ) : null}

          {chunksData ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Found{" "}
                <strong>{chunksData.count}</strong> text snippet{chunksData.count === 1 ? "" : "s"} for{" "}
                <span className="font-mono">{chunksData.orgnr}</span>
              </p>
              {chunksData.count === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No examples for this number</AlertTitle>
                  <AlertDescription className="text-sm">
                    Either no data was indexed for this org.nr, or the manifest did not link this company when
                    examples were imported. Try another org.nr from your list, or ask your team to check the
                    exemplar manifest and indexer.
                  </AlertDescription>
                </Alert>
              ) : (
                <ul className="space-y-3">
                  {chunksData.chunks.map((c) => (
                    <li
                      key={c.chunk_id}
                      className="rounded-lg border border-border/80 bg-background px-3 py-2 shadow-sm"
                    >
                      <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          <span className="font-medium text-foreground">{c.slug}</span>
                          <span className="mx-1">·</span>part {c.chunk_index + 1}
                        </span>
                        {c.manifest_version ? <span>Indexed as v{c.manifest_version}</span> : null}
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                        {c.content_text}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            Indexing example reports (administrators)
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Read this if you need the &quot;Search&quot; box above to return text. Analysts can skip this
            section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-foreground/90">
          <div className="space-y-2">
            <p className="font-medium text-foreground">What indexing does</p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                Reads the manifest file{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  exemplar_reports_manifest.json
                </code>{" "}
                in the repo (it lists which example <code className="rounded bg-muted px-1 py-0.5 text-xs">.md</code>{" "}
                reports to use).
              </li>
              <li>
                Splits each report into smaller text <strong className="text-foreground">chunks</strong> (about
                up to 1–2k characters each) so they can be stored in the database.
              </li>
              <li>
                <strong className="text-foreground">Postgres mode</strong> (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">--postgres</code>) writes those chunks
                into the table <code className="rounded bg-muted px-1 py-0.5 text-xs">ai_ops.exemplar_report_chunks</code>
                . That is exactly what this page reads when you search by org.nr.
              </li>
              <li>
                <strong className="text-foreground">Optional embeddings</strong> (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">--postgres --pgvector</code>) also stores
                vector embeddings for similarity search (needs <code className="rounded bg-muted px-1 py-0.5 text-xs">OPENAI_API_KEY</code>
                ). Not required just to see text snippets here.
              </li>
              <li>
                <strong className="text-foreground">Chroma mode</strong> (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">--chroma</code>) builds a separate local
                vector index for other tooling; the web UI does not use it for the search box above.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Before you run the command</p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                Apply database migration{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">042_exemplar_report_chunks.sql</code>{" "}
                once on the same Postgres the API uses (so the table exists).
              </li>
              <li>
                Run the script from a machine that has the Nivo repo and can connect to that database (same{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code> or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">POSTGRES_*</code> as the backend).
              </li>
              <li>
                To match a company in the UI search, set that company&apos;s Swedish{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">orgnr</code> on the right entry in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">exemplar_reports_manifest.json</code>, then
                run the indexer again.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">How to run it</p>
            <p className="text-muted-foreground">
              In a terminal, from the <strong className="text-foreground">project root</strong> (folder that
              contains <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/</code>):
            </p>
            <pre
              className={cn(
                "overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground"
              )}
            >
              {`# Load env (or export DATABASE_URL / POSTGRES_* yourself)
cd /path/to/nivo

# Install Python deps if needed: pip install -r backend/requirements.txt (includes psycopg2)

# One-time: create rows for this UI
python3 scripts/index_exemplar_markdown.py --postgres

# Optional: also fill embedding column for vector search elsewhere
# export OPENAI_API_KEY=...
# python3 scripts/index_exemplar_markdown.py --postgres --pgvector`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Re-run the same command after you add or change example <code className="rounded bg-muted px-1 py-0.5">.md</code> files
              or update the manifest.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
