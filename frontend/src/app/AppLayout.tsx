import { Outlet, NavLink, useLocation } from "react-router-dom";
import { appNavItems } from "@/app/nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Settings } from "lucide-react";

export function AppLayout() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const isAdmin = userRole === "admin" || user?.email === "jesper@rgcapital.se";

  const mainNavItems = appNavItems.filter((item) => item.to !== "/app/admin");

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Sidebar - Admin and User always visible at bottom */}
      <aside className="w-[220px] border-r bg-background flex flex-col min-h-screen">
        <div className="h-14 px-4 flex items-center border-b shrink-0">
          <img
            src="/nivo-wordmark-green.svg"
            alt="Nivo"
            className="h-6"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <nav className="p-3 space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="px-4 pb-2 text-xs text-muted-foreground">
            {location.pathname}
          </div>
        </ScrollArea>

        {/* Admin + User + Sign out - always visible, sticky at bottom */}
        <div className="p-3 border-t shrink-0 space-y-2 bg-background">
          {isAdmin && (
            <NavLink
              to="/app/admin"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )
              }
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Admin</span>
            </NavLink>
          )}
          {user && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <Avatar className="h-7 w-7 rounded-md shrink-0">
                <AvatarFallback className="rounded-md text-[11px] bg-muted">
                  {user.email ? user.email.slice(0, 2).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate" title={user.email ?? undefined}>
                  {user.email ?? "Signed in"}
                </div>
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar: Admin + User always visible on all pages */}
        <div className="h-14 border-b shrink-0 flex items-center justify-between px-4">
          <div />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <NavLink
                to="/app/admin"
                className={({ isActive }) =>
                  cn(
                    "text-xs rounded-md px-2 py-1.5 transition-colors",
                    isActive ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"
                  )
                }
              >
                Admin
              </NavLink>
            )}
            {user?.email && (
              <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={user.email}>
                {user.email}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
