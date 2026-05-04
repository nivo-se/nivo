import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home,
  Globe,
  List,
  Target,
  Cpu,
  Settings,
  Shield,
  LogOut,
  Search,
  Building2,
  LayoutList,
  Briefcase,
  BookOpen,
  ListFilter,
  ScanSearch,
  Menu,
  CalendarDays,
  Inbox as InboxIcon,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminLinkVisible } from "@/lib/isAdmin";
import {
  isHideInDevelopmentNav,
  isHideLegacySurfacesNav,
  isNavUnifiedV1,
} from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  indent?: boolean;
  adminOnly?: boolean;
  /** Match this path only (no sub-routes). Use for parent items with nested pages. */
  exact?: boolean;
  /** Unified nav: custom active state (e.g. alias routes vs real URLs after redirect). */
  matchesLocation?: (pathname: string, search: string) => boolean;
}

const mainNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/universe", label: "Universe", icon: Globe },
  { path: "/prospects", label: "Prospects", icon: Target },
  { path: "/lists", label: "My Lists", icon: List },
  {
    path: "/crm/companies",
    label: "Companies",
    icon: Building2,
    matchesLocation: (pathname) =>
      pathname === "/crm/companies" || pathname.startsWith("/crm/company/"),
  },
  {
    path: "/crm",
    label: "Mailbox",
    icon: Briefcase,
    matchesLocation: (pathname, search) => {
      if (pathname !== "/crm") return false;
      return new URLSearchParams(search).get("tab") !== "inbox";
    },
  },
  { path: "/ai", label: "AI Lab", icon: Cpu },
];

/** Phase-1 unified nav: routes alias to existing pages until dedicated surfaces land. */
const unifiedNavSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Daily workstreams",
    items: [
      {
        path: "/today",
        label: "Today",
        icon: CalendarDays,
        matchesLocation: (pathname) => pathname === "/" || pathname === "/today",
      },
    ],
  },
  {
    title: "Research",
    items: [
      {
        path: "/companies",
        label: "Companies",
        icon: Globe,
        matchesLocation: (pathname) => pathname === "/universe" || pathname === "/companies",
      },
      {
        path: "/sourcing",
        label: "Sourcing chat",
        icon: Sparkles,
        matchesLocation: (pathname) => pathname === "/sourcing",
      },
      {
        path: "/prospects",
        label: "Prospects",
        icon: Target,
        matchesLocation: (pathname) => pathname === "/prospects",
      },
      {
        path: "/research",
        label: "Research",
        icon: Cpu,
        matchesLocation: (pathname) =>
          pathname === "/ai" || pathname.startsWith("/ai/") || pathname === "/research",
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        path: "/crm/companies",
        label: "Companies",
        icon: Building2,
        matchesLocation: (pathname) =>
          pathname === "/crm/companies" || pathname.startsWith("/crm/company/"),
      },
      {
        path: "/crm",
        label: "Mailbox",
        icon: Briefcase,
        matchesLocation: (pathname, search) => {
          if (!pathname.startsWith("/crm")) return false;
          if (pathname === "/crm/companies" || pathname.startsWith("/crm/company/")) return false;
          const tab = new URLSearchParams(search).get("tab");
          return tab !== "inbox";
        },
      },
      {
        path: "/inbox",
        label: "Inbox",
        icon: InboxIcon,
        matchesLocation: (pathname, search) =>
          pathname.startsWith("/crm") && new URLSearchParams(search).get("tab") === "inbox",
      },
    ],
  },
];

/** Shown above the "In development" divider */
const aboveDevNavItems: NavItem[] = [
  { path: "/gpt-target-universe", label: "GPT target universe", icon: ScanSearch, exact: true },
];

/** WIP / preview surfaces visible to the whole team while features stabilize */
const testingNavItems: NavItem[] = [
  { path: "/sourcing", label: "Sourcing chat", icon: Sparkles, exact: true },
  /** prefix match so `/screening-shortlist/:runId` stays highlighted */
  { path: "/screening-shortlist", label: "Screening shortlist", icon: ListFilter },
  { path: "/screening-campaigns", label: "Screening campaigns", icon: Building2, exact: true },
  { path: "/screening-campaigns/exemplars", label: "Playbook & examples", icon: BookOpen, indent: true },
  { path: "/deep-research", label: "Deep Research", icon: Search },
  { path: "/deep-research/runs", label: "Runs", icon: LayoutList, indent: true },
];

function buildLegacyMainNav(): NavItem[] {
  if (!isHideLegacySurfacesNav()) return mainNavItems;
  return mainNavItems.filter((item) => item.path !== "/prospects");
}

export default function AppLayout() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navUnified = isNavUnifiedV1();
  const hideInDev = isHideInDevelopmentNav();
  const primaryNavItems = buildLegacyMainNav();
  const showAboveDevNav = !navUnified && !isHideLegacySurfacesNav();
  const showInDevelopmentSection = !hideInDev && !navUnified;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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

  const navLinks = (items: NavItem[], onNavigate?: () => void) =>
    items.map((item) => {
      if (item.adminOnly && !isAdmin) return null;
      const Icon = item.icon;
      const active = item.matchesLocation
        ? item.matchesLocation(location.pathname, location.search)
        : isActive(item.path, item.exact);
      return (
        <Link
          key={`${item.path}-${item.label}`}
          to={item.path === "/" ? "/" : item.path}
          onClick={() => onNavigate?.()}
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

  const renderSidebar = (onNavigate?: () => void) => (
    <div className="flex h-full min-h-0 flex-col bg-sidebar-bg">
      <div className="shrink-0 border-b border-sidebar-border/80 p-6">
        <Link
          to="/"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <img src="/nivo-wordmark.svg" alt="Nivo" className="h-6 w-auto dark:hidden" />
          <img src="/nivo-wordmark-white.svg" alt="Nivo" className="hidden h-6 w-auto dark:block" />
        </Link>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3">
        {navUnified ? (
          <>
            {unifiedNavSections.map((section, idx) => (
              <div key={section.title}>
                <div
                  className={
                    idx === 0
                      ? "px-3 pb-2 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted"
                      : "mt-3 border-t border-sidebar-border/80 px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted"
                  }
                  role="presentation"
                >
                  {section.title}
                </div>
                <div className="space-y-0.5">{navLinks(section.items, onNavigate)}</div>
              </div>
            ))}
          </>
        ) : (
          navLinks(primaryNavItems, onNavigate)
        )}
        {showAboveDevNav ? (
          <div className="mt-3 space-y-0.5">{navLinks(aboveDevNavItems, onNavigate)}</div>
        ) : null}
        {showInDevelopmentSection ? (
          <>
            <div
              className="mt-3 border-t border-sidebar-border/80 px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted"
              role="presentation"
            >
              In development
            </div>
            {navLinks(testingNavItems, onNavigate)}
          </>
        ) : null}
      </nav>
      <div className="mt-auto w-full shrink-0 pt-3">
        <div className="space-y-3 border-t border-sidebar-border/80 px-4 pb-4 pt-4">
          <Link
            to="/settings"
            onClick={() => onNavigate?.()}
            className={`flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-3 pr-3 text-sm transition-colors ${
              location.pathname.startsWith("/settings")
                ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 opacity-90" />
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-3 pr-3 text-sm transition-colors ${
                location.pathname.startsWith("/admin")
                  ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                  : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
              }`}
            >
              <Shield className="h-4 w-4 shrink-0 opacity-90" />
              Admin
            </Link>
          )}
          <div>
            <div className="truncate text-sm font-medium text-foreground">{user?.email ?? "User"}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              onNavigate?.();
              void handleSignOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground md:h-screen md:max-h-screen md:flex-row">
      <aside className="hidden h-full min-h-0 w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg shadow-[4px_0_24px_-12px_hsl(var(--primary)/0.18)] md:flex">
        {renderSidebar()}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 touch-manipulation"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <Link to="/" className="flex min-w-0 items-center" onClick={() => setMobileNavOpen(false)}>
            <img src="/nivo-wordmark.svg" alt="Nivo" className="h-5 w-auto dark:hidden" />
            <img src="/nivo-wordmark-white.svg" alt="Nivo" className="hidden h-5 w-auto dark:block" />
          </Link>
        </header>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="flex w-[min(20rem,calc(100vw-1rem))] max-w-[280px] flex-col gap-0 border-sidebar-border bg-sidebar-bg p-0 [&>button]:text-sidebar-fg"
          >
            <SheetTitle className="sr-only">Main navigation</SheetTitle>
            {renderSidebar(() => setMobileNavOpen(false))}
          </SheetContent>
        </Sheet>

        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-8%,hsl(var(--primary)/0.11),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_55%_at_50%_-5%,hsl(var(--primary)/0.14),transparent_50%)]"
            aria-hidden
          />
          <div className="relative min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
