import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Globe, List, Target, Cpu, Settings, Shield, LogOut, Search, Building2, LayoutList, Briefcase, BookOpen, ListFilter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminLinkVisible } from "@/lib/isAdmin";
import { Button } from "@/components/ui/button";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  indent?: boolean;
  adminOnly?: boolean;
  /** Match this path only (no sub-routes). Use for parent items with nested pages. */
  exact?: boolean;
}

const mainNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/universe", label: "Universe", icon: Globe },
  { path: "/prospects", label: "Prospects", icon: Target },
  { path: "/lists", label: "My Lists", icon: List },
  { path: "/ai", label: "AI Lab", icon: Cpu },
  { path: "/ai/runs", label: "Recent Runs", icon: Cpu, indent: true },
];

/** Shown above the "In development" divider */
const aboveDevNavItems: NavItem[] = [
  /** prefix match so `/screening-shortlist/:runId` stays highlighted */
  { path: "/screening-shortlist", label: "Screening shortlist", icon: ListFilter },
];

/** WIP / preview surfaces visible to the whole team while features stabilize */
const testingNavItems: NavItem[] = [
  { path: "/screening-campaigns", label: "Screening campaigns", icon: Building2, exact: true },
  { path: "/screening-campaigns/exemplars", label: "Playbook & examples", icon: BookOpen, indent: true },
  { path: "/deep-research", label: "Deep Research", icon: Search },
  { path: "/deep-research/runs", label: "Runs", icon: LayoutList, indent: true },
  { path: "/crm", label: "CRM", icon: Briefcase },
];

export default function AppLayout() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const isActive = (path: string, exact?: boolean) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "";
    const norm = (s: string) => s.replace(/\/$/, "") || "/";
    if (exact) return norm(location.pathname) === norm(path);
    return path !== "/" && location.pathname.startsWith(path);
  };

  const navLinks = (items: NavItem[]) =>
    items.map((item) => {
      if (item.adminOnly && !isAdmin) return null;
      const Icon = item.icon;
      const active = isActive(item.path, item.exact);
      return (
        <Link
          key={`${item.path}-${item.label}`}
          to={item.path === "/" ? "/" : item.path}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            active
              ? "bg-sidebar-hover-bg !text-sidebar-fg font-medium"
              : "!text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
          } ${item.indent ? "pl-8" : ""}`}
        >
          <Icon className="w-4 h-4" />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-56 bg-sidebar-bg border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src="/nivo-wordmark.svg"
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
          {navLinks(mainNavItems)}
          <div className="mt-3 space-y-0.5">{navLinks(aboveDevNavItems)}</div>
          <div
            className="mt-3 border-t border-sidebar-border px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted"
            role="presentation"
          >
            In development
          </div>
          {navLinks(testingNavItems)}
        </nav>
        <div className="mt-auto shrink-0 w-full pt-3">
          <div className="border-t border-sidebar-border px-4 pt-4 pb-4 space-y-3">
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                location.pathname.startsWith("/settings")
                  ? "bg-sidebar-hover-bg !text-sidebar-fg font-medium"
                  : "!text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  location.pathname.startsWith("/admin")
                    ? "bg-sidebar-hover-bg !text-sidebar-fg font-medium"
                    : "!text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            <div>
              <div className="text-sm font-medium text-foreground truncate">
                {user?.email ?? "User"}
              </div>
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
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
