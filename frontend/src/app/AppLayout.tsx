import { Outlet, NavLink, useLocation } from "react-router-dom";
import { appNavItems } from "@/app/nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLayout() {
  const location = useLocation();
  const { user, signOut } = useAuth();

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
      {/* Sidebar */}
      <aside className="w-[280px] border-r bg-background">
        <div className="h-14 px-4 flex items-center border-b">
          <div className="font-semibold tracking-tight">Nivo</div>
          <div className="ml-2 text-xs text-muted-foreground">Backend</div>
        </div>

        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <nav className="p-3 space-y-1">
            {appNavItems.map((item) => {
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

          <div className="px-4 pb-4 text-xs text-muted-foreground">
            {location.pathname}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground" />
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="text-sm text-muted-foreground">{user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
