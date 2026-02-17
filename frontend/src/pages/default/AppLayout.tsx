import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Globe, List, Target, Cpu, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/universe", label: "Universe", icon: Globe },
  { path: "/prospects", label: "Prospects", icon: Target },
  { path: "/lists", label: "My Lists", icon: List },
  { path: "/ai", label: "AI Lab", icon: Cpu },
  { path: "/admin", label: "Admin", icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "";
    return path !== "/" && location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-56 bg-sidebar-bg border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src="/nivo-wordmark-green.svg"
              alt="Nivo"
              className="h-6 w-auto dark:hidden"
            />
            <img
              src="/nivo-wordmark-white.svg"
              alt="Nivo"
              className="h-6 w-auto hidden dark:block"
            />
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path === "/" ? "/" : item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-hover-bg !text-sidebar-fg font-medium"
                    : "!text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
                } ${item.indent ? "pl-6" : ""}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-3 mt-auto">
          <div>
            <div className="text-sm font-medium text-foreground truncate">
              {user?.email ?? "User"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Team Plan</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
