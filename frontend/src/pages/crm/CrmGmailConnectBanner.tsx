import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccessToken, isAuth0Configured } from "@/lib/authToken";
import {
  disconnectCrmGmail,
  getCrmGmailOAuthUrl,
  syncCrmGmailInbound,
  type CrmEmailConfig,
  type CrmGmailStatus,
} from "@/lib/api/crm";
import { useToast } from "@/hooks/use-toast";

type Props = {
  emailConfig: CrmEmailConfig | null;
  gmailStatus: CrmGmailStatus | null;
  connectBusy: boolean;
  onConnectStart: () => void;
  onConnectEnd: () => void;
  /** Called after successful disconnect to refresh parent status */
  onGmailDisconnected?: () => void;
  loading?: boolean;
};

/**
 * Shown on all CRM /crm routes. Previously only appeared on the Home / mailbox sub-view,
 * so users on Inbox / company / Quick send could not find "Connect Gmail".
 */
export function CrmGmailConnectBanner({
  emailConfig,
  gmailStatus,
  connectBusy,
  onConnectStart,
  onConnectEnd,
  onGmailDisconnected,
  loading,
}: Props) {
  const { toast } = useToast();
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const gmailReadOnly = gmailStatus?.workspace?.gmail_readonly === true;
  if (loading && !emailConfig) {
    return (
      <div
        className="mb-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground"
        role="status"
        aria-label="Loading email settings"
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        Loading email settings…
      </div>
    );
  }

  if (emailConfig === null) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
        <p className="text-foreground font-medium">Could not load CRM email settings</p>
        <p className="mt-1.5 leading-relaxed">
          The CRM UI talks to a <strong>separate</strong> Node process (enhanced server) at{" "}
          <code className="rounded bg-muted px-1">/crm/*</code>, not the Python API at <code className="rounded bg-muted px-1">/api</code>
          . On <strong>Vercel</strong>, the static build does <strong>not</strong> run that server — the browser
          would get the SPA instead of JSON unless you set the CRM base URL at build time.
        </p>
        <p className="mt-1.5 leading-relaxed">
          In the Vercel project, set <code className="rounded bg-muted px-1">VITE_CRM_BASE_URL</code> to the{" "}
          <strong>public origin</strong> where Node serves CRM (e.g. your Cloudflare host for port 3001), then
          trigger a <strong>new deployment</strong>. Example: <code className="rounded bg-muted px-1">https://crm.nivogroup.se</code>{" "}
          (not <code className="rounded bg-muted px-1">api.…</code> for FastAPI — that has no <code className="rounded bg-muted px-1">/crm</code> routes). Ensure
          CORS on that Node host allows this app’s origin, and the enhanced server is running with Postgres env.
        </p>
      </div>
    );
  }

  if (!emailConfig.gmail_oauth_server_configured) {
    return (
      <div className="mb-4 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Gmail (send from your inbox)</p>
        <p className="mt-1 text-xs leading-relaxed">
          This is not turned on for the environment that serves CRM to your browser. On the host running the{" "}
          <strong>enhanced server</strong>, set <code className="text-[11px]">GOOGLE_OAUTH_CLIENT_ID</code>,{" "}
          <code className="text-[11px]">GOOGLE_OAUTH_CLIENT_SECRET</code>, <code className="text-[11px]">GOOGLE_OAUTH_REDIRECT_URI</code>, and{" "}
          <code className="text-[11px]">GMAIL_OAUTH_ENCRYPTION_KEY</code>, then redeploy. See{" "}
          <code className="text-[11px]">docs/CRM_GMAIL_OAUTH.md</code> in the repo.
        </p>
        <p className="mt-1.5 text-xs">Until then, sending may use <strong>Resend</strong> if that is configured for CRM.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5 text-sm">
      <div className="min-w-0 text-muted-foreground">
        {gmailStatus?.connected && gmailStatus.google_email ? (
          <span>
            <span className="font-medium text-foreground">Gmail: </span>
            {gmailStatus.google_display_name
              ? `${gmailStatus.google_display_name} · ${gmailStatus.google_email}`
              : gmailStatus.google_email}
            <span className="ml-1">
              — send from CRM uses this inbox
              {gmailReadOnly ? "; replies can be imported into CRM." : "."}
            </span>
          </span>
        ) : (
          <span>Send from your own Google Workspace inbox (sign in with Google once per teammate).</span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {gmailStatus?.connected && !gmailReadOnly ? (
          <p className="max-w-[280px] text-xs text-amber-800 dark:text-amber-200/90">
            Reconnect Gmail once to allow read-only inbox import so team CRM shows replies.
          </p>
        ) : null}
        {gmailStatus?.connected && gmailReadOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncBusy}
            onClick={async () => {
              setSyncBusy(true);
              try {
                const out = await syncCrmGmailInbound();
                toast({
                  title: "Gmail sync finished",
                  description: `${out.imported} new message(s) imported, ${out.skipped_duplicate} already had, ${out.skipped_not_crm} skipped (not CRM-related).`,
                });
                if (out.errors.length) {
                  toast({
                    title: "Sync notes",
                    description: out.errors.slice(0, 3).join(" "),
                    variant: "destructive",
                  });
                }
              } catch (e) {
                toast({
                  title: "Sync failed",
                  description: e instanceof Error ? e.message : String(e),
                  variant: "destructive",
                });
              } finally {
                setSyncBusy(false);
              }
            }}
          >
            {syncBusy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            {syncBusy ? "Syncing…" : "Import inbox replies"}
          </Button>
        ) : null}
        {!gmailStatus?.connected ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              onConnectStart();
              if (!isAuth0Configured()) {
                toast({
                  title: "Sign in to Nivo first",
                  description:
                    "Gmail is linked to your Nivo login. Set VITE_AUTH0_* in the app build and sign in, then try again.",
                  variant: "destructive",
                });
                onConnectEnd();
                return;
              }
              const token = await getAccessToken();
              if (!token) {
                toast({
                  title: "Sign in to Nivo first",
                  description: "Use Log in, then connect Gmail again.",
                  variant: "destructive",
                });
                onConnectEnd();
                return;
              }
              try {
                const url = await getCrmGmailOAuthUrl();
                window.location.assign(url);
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                toast({
                  title: "Could not start Google sign-in",
                  description:
                    msg === "Authentication required" || msg.includes("401")
                      ? "Session expired — sign in to Nivo again, then connect Gmail."
                      : msg,
                  variant: "destructive",
                });
                onConnectEnd();
              }
              /* Success path redirects; no onConnectEnd */
            }}
            disabled={connectBusy}
          >
            {connectBusy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            {connectBusy ? "Redirecting…" : "Connect Gmail"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={async () => {
              if (!isAuth0Configured()) {
                toast({ title: "Sign in to Nivo first", variant: "destructive" });
                return;
              }
              const token = await getAccessToken();
              if (!token) {
                toast({ title: "Session expired", description: "Sign in again, then try disconnect.", variant: "destructive" });
                return;
              }
              setDisconnectBusy(true);
              try {
                await disconnectCrmGmail();
                toast({ title: "Gmail disconnected" });
                onGmailDisconnected?.();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                toast({ title: "Could not disconnect", description: msg, variant: "destructive" });
              } finally {
                setDisconnectBusy(false);
              }
            }}
            disabled={disconnectBusy}
          >
            {disconnectBusy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            {disconnectBusy ? "…" : "Disconnect Gmail"}
          </Button>
        )}
      </div>
    </div>
  );
}
