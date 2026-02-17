import { useQuery } from "@tanstack/react-query";
import AdminPanel from "@/components/AdminPanel";
import { getHomeDashboard } from "@/lib/services/homeService";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, BarChart3, Users, Settings } from "lucide-react";

export function AdminPage() {
  const { user } = useAuth();
  const { data: dashboard } = useQuery({
    queryKey: ["homeDashboard"],
    queryFn: () => getHomeDashboard("30d"),
    staleTime: 30_000,
  });

  const dbOk = dashboard?.status?.db_ok ?? false;
  const totalCompanies = dashboard?.universe?.total_companies ?? dashboard?.coverage?.total_companies ?? 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          System overview, user management, and settings
        </p>
      </div>

      {/* Section: System overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            System overview
          </CardTitle>
          <CardDescription>Database status and universe totals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Database</span>
            <span className={`text-sm font-medium ${dbOk ? "text-primary" : "text-destructive"}`}>
              {dbOk ? "Connected" : "Error"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total companies</span>
            <span className="text-sm font-medium">{totalCompanies.toLocaleString()}</span>
          </div>
          <Button variant="outline" size="xs" asChild>
            <a href="/app/universe">Open Universe</a>
          </Button>
        </CardContent>
      </Card>

      {/* Section: User management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            User management
          </CardTitle>
          <CardDescription>Add users, approve pending accounts, manage roles</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminPanel currentUser={user} />
        </CardContent>
      </Card>

      {/* Section: Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </CardTitle>
          <CardDescription>Configure integrations and system preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="xs" disabled>
            Manage settings (coming soon)
          </Button>
        </CardContent>
      </Card>

      {/* Section: Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage
          </CardTitle>
          <CardDescription>Platform activity and analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Usage charts and activity data will appear here when available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
