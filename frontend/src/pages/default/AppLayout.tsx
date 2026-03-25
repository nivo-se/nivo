import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Globe, List, Target, Cpu, Settings, Shield, LogOut, Search, Building2, LayoutList, Briefcase, BookOpen, ListFilter, ScanSearch } from "lucide-react";
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
];

/** Shown above the "In development" divider */
const aboveDevNavItems: NavItem[] = [
  { path: "/gpt-target-universe", label: "GPT target universe", icon: ScanSearch, exact: true },
];

/** WIP / preview surfaces visible to the whole team while features stabilize */
const testingNavItems: NavItem[] = [
  /** prefix match so `/screening-shortlist/:runId` stays highlighted */
  { path: "/screening-shortlist", label: "Screening shortlist", icon: ListFilter },
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
          className={`flex items-center gap-3 py-2 pr-3 rounded-md text-sm transition-colors border-l-[3px] ${
            item.indent ? "pl-8" : "pl-3"
          } ${
            active
              ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
              : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0 opacity-90" />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-56 bg-sidebar-bg border-r border-sidebar-border flex flex-col shadow-[4px_0_24px_-12px_hsl(var(--primary)/0.18)]">
        <div className="p-6 border-b border-sidebar-border/80 shrink-0">
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
            className="mt-3 border-t border-sidebar-border/80 px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted"
            role="presentation"
          >
            In development
          </div>
          {navLinks(testingNavItems)}
        </nav>
        <div className="mt-auto shrink-0 w-full pt-3">
          <div className="border-t border-sidebar-border/80 px-4 pt-4 pb-4 space-y-3">
            <Link
              to="/settings"
              className={`flex items-center gap-3 py-2 pr-3 pl-3 rounded-md text-sm transition-colors border-l-[3px] ${
                location.pathname.startsWith("/settings")
                  ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                  : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0 opacity-90" />
              Settings
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-3 py-2 pr-3 pl-3 rounded-md text-sm transition-colors border-l-[3px] ${
                  location.pathname.startsWith("/admin")
                    ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                    : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
                }`}
              >
                <Shield className="w-4 h-4 shrink-0 opacity-90" />
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
      <main className="flex-1 overflow-auto bg-background relative min-h-0">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-8%,hsl(var(--primary)/0.11),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_55%_at_50%_-5%,hsl(var(--primary)/0.14),transparent_50%)]"
          aria-hidden
        />
        <div className="relative min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
