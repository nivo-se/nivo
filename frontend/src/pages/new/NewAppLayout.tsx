import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Globe, List, Target, Cpu, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import "@/styles/newTheme.css";

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/universe", label: "Universe", icon: Globe },
  { path: "/prospects", label: "Prospects", icon: Target },
  { path: "/lists", label: "My Lists", icon: List },
  { path: "/ai", label: "AI Lab", icon: Cpu },
  { path: "/admin", label: "Admin", icon: Settings },
];

export default function NewAppLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "";
    return path !== "/" && location.pathname.startsWith(path);
  };

  return (
    <div className="new-theme flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-900">
            {user?.email ?? "User"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Team Plan</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path === "/" ? "/" : item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${item.indent ? "pl-6" : ""}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
