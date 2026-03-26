import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { appNavItems } from "@/app/nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminLinkVisible } from "@/lib/isAdmin";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Settings, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type AppNavItem = (typeof appNavItems)[number];

function AppSidebarPanel({
  onNavigate,
  mainNavItems,
  isAdmin,
  user,
  handleSignOut,
  locationPath,
}: {
  onNavigate?: () => void;
  mainNavItems: AppNavItem[];
  isAdmin: boolean;
  user: { email?: string } | null;
  handleSignOut: () => void | Promise<void>;
  locationPath: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar-bg">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border/80 px-4">
        <Link
          to="/app/home"
          onClick={() => onNavigate?.()}
          className="flex items-center transition-opacity hover:opacity-80"
        >
          <img src="/nivo-wordmark.svg" alt="Nivo" className="h-6" />
        </Link>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-1 p-3">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-3 pr-3 text-sm transition-colors",
                    isActive
                      ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                      : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 pb-2 text-xs text-muted-foreground">{locationPath}</div>
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t border-sidebar-border/80 bg-sidebar-bg p-3">
        {isAdmin && (
          <NavLink
            to="/app/admin"
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-3 pr-3 text-sm transition-colors",
                isActive
                  ? "border-primary bg-sidebar-active-bg !text-sidebar-active-fg font-medium"
                  : "border-transparent !text-sidebar-muted hover:bg-sidebar-hover-bg hover:!text-sidebar-fg"
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Admin</span>
          </NavLink>
        )}
        {user && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <Avatar className="h-7 w-7 shrink-0 rounded-md">
              <AvatarFallback className="rounded-md bg-muted text-[11px]">
                {user.email ? user.email.slice(0, 2).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted-foreground" title={user.email ?? undefined}>
                {user.email ?? "Signed in"}
              </div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onNavigate?.();
            void handleSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const isAdmin = isAdminLinkVisible(userRole, user?.email, !!user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const mainNavItems = appNavItems.filter((item) => item.to !== "/app/admin");

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  const sidebarProps = {
    mainNavItems,
    isAdmin,
    user,
    handleSignOut,
    locationPath: location.pathname,
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-hidden bg-background md:h-screen md:max-h-screen md:flex-row">
      <aside className="hidden h-full min-h-0 w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg shadow-[4px_0_24px_-12px_hsl(var(--primary)/0.18)] md:flex">
        <AppSidebarPanel {...sidebarProps} />
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-8%,hsl(var(--primary)/0.11),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_55%_at_50%_-5%,hsl(var(--primary)/0.14),transparent_50%)]"
          aria-hidden
        />

        <div className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/80 px-3 backdrop-blur-sm sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 touch-manipulation md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <NavLink
                to="/app/admin"
                className={({ isActive }) =>
                  cn(
                    "hidden rounded-md px-2 py-1.5 text-xs transition-colors sm:inline-flex",
                    isActive ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"
                  )
                }
              >
                Admin
              </NavLink>
            )}
            {user?.email && (
              <span
                className="hidden max-w-[min(42vw,9rem)] truncate text-xs text-muted-foreground sm:inline sm:max-w-[11rem]"
                title={user.email}
              >
                {user.email}
              </span>
            )}
          </div>
        </div>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="flex w-[min(20rem,calc(100vw-1rem))] max-w-[280px] flex-col gap-0 border-sidebar-border bg-sidebar-bg p-0 [&>button]:text-sidebar-fg"
          >
            <SheetTitle className="sr-only">App navigation</SheetTitle>
            <AppSidebarPanel {...sidebarProps} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
