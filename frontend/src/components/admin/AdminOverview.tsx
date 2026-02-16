import { useQuery } from "@tanstack/react-query";
import { getHomeDashboard } from "@/lib/services/homeService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Clock, Database, Users, ChevronRight } from "lucide-react";

interface AdminOverviewProps {
  onNavigateToUsers: () => void;
}

const ROLE_TIERS = [
  {
    id: "admin",
    label: "Admin",
    description: "Full access. Manage users, settings, and system configuration.",
    icon: Shield,
    color: "text-red-600",
  },
  {
    id: "approved",
    label: "Approved",
    description: "Standard access. Browse universe, use lists, and run enrichment.",
    icon: CheckCircle,
    color: "text-green-600",
  },
  {
    id: "pending",
    label: "Pending",
    description: "Awaiting approval. No platform access until approved.",
    icon: Clock,
    color: "text-amber-600",
  },
] as const;

export function AdminOverview({ onNavigateToUsers }: AdminOverviewProps) {
  const { data: dashboard, isLoading, isError } = useQuery({
    queryKey: ["homeDashboard"],
    queryFn: getHomeDashboard,
    staleTime: 30_000,
  });

  const dbOk = dashboard?.status?.db_ok ?? false;
  const totalCompanies = dashboard?.universe?.total_companies ?? dashboard?.coverage?.total_companies;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-0.5">
          System health, access tiers, and quick actions
        </p>
      </div>

      {/* Role tiers - Cursor-style plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLE_TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card key={tier.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${tier.color}`} />
                    {tier.label}
                  </CardTitle>
                </div>
                <CardDescription className="text-sm">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onNavigateToUsers}
                >
                  Manage users
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* System status - Cursor-style metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{dbOk ? "Healthy" : "Degraded"}</p>
                <p className="text-xs text-muted-foreground">Database connection</p>
              </div>
              <Badge variant={dbOk ? "default" : "destructive"} className={dbOk ? "bg-green-500" : ""}>
                {dbOk ? "Connected" : "Error"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Universe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {isLoading || isError ? "—" : (totalCompanies ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total companies</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href="/app/universe">View</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick action */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User management</CardTitle>
          <CardDescription>
            Add users, approve pending accounts, and manage roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onNavigateToUsers}>
            <Users className="h-4 w-4 mr-2" />
            Open user management
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
