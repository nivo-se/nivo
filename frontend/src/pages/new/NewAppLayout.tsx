import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Globe, List, Cpu, Settings } from "lucide-react";
import "@/styles/newTheme.css";

const navItems = [
  { path: "/new", label: "Dashboard", icon: Home },
  { path: "/new/universe", label: "Universe", icon: Globe },
  { path: "/new/lists", label: "My Lists", icon: List },
  { path: "/new/ai", label: "AI Lab", icon: Cpu },
  { path: "/new/admin", label: "Admin", icon: Settings },
];

export default function NewAppLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/new") return location.pathname === "/new" || location.pathname === "/new/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="new-theme flex h-screen">
      <aside className="new-sidebar w-56 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-900">New UX</div>
          <div className="text-xs text-gray-500 mt-0.5">Figma export</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path === "/new" ? "/new" : item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="new-bg flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
