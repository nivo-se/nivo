import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccessToken, isAuth0Configured } from "@/lib/authToken";
import { getCrmGmailOAuthUrl, type CrmEmailConfig, type CrmGmailStatus } from "@/lib/api/crm";
import { useToast } from "@/hooks/use-toast";

type Props = {
  emailConfig: CrmEmailConfig | null;
  gmailStatus: CrmGmailStatus | null;
  connectBusy: boolean;
  onConnectStart: () => void;
  onConnectEnd: () => void;
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
  loading,
}: Props) {
  const { toast } = useToast();

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
        Could not load CRM email settings. Check that the <strong>enhanced server</strong> (Node,{" "}
        <code className="rounded bg-muted px-1">/crm</code>) is deployed and that your session can reach
        it.
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
            {gmailStatus.google_email}
            <span className="ml-1">— outbound from CRM can use this inbox.</span>
          </span>
        ) : (
          <span>Send from your own Google Workspace inbox (sign in with Google once per teammate).</span>
        )}
      </div>
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
      ) : null}
    </div>
  );
}
