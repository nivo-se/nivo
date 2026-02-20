import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";

/**
 * Auth0 redirect target. The SDK processes the callback URL; we show loading then redirect to /.
 */
export default function AuthCallback() {
  const { isAuthenticated, isLoading, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (error) {
      navigate("/auth", { replace: true, state: { error: error.message } });
      return;
    }
    if (isAuthenticated) {
      navigate("/", { replace: true });
    } else {
      navigate("/auth", { replace: true });
    }
  }, [isAuthenticated, isLoading, error, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
