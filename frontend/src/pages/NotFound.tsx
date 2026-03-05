import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-profile-bg-subtle px-4">
      <Card
        className="w-full max-w-md border-profile-divider bg-card shadow-lg"
        style={{ boxShadow: "var(--profile-shadow-soft, 0 2px 12px rgba(0,0,0,0.06))" }}
      >
        <CardHeader className="text-center pb-2">
          <p className="text-6xl font-bold text-profile-fg-muted tracking-tight">
            404
          </p>
          <CardTitle className="text-xl mt-2 text-profile-fg">
            Page not found
          </CardTitle>
          <CardDescription className="text-base mt-1 text-profile-fg-muted">
            The page you&apos;re looking for doesn&apos;t exist or the link may
            have changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-profile-accent text-[hsl(var(--brand-foreground))] border-profile-accent hover:bg-profile-accent/90 focus-visible:ring-profile-accent/40 focus-visible:ring-offset-2"
          >
            <Link to="/">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="gap-2 border-profile-divider text-profile-fg hover:bg-profile-accent-muted hover:text-profile-fg"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
