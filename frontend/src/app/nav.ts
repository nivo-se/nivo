import {
  Home,
  Search,
  Layers,
  FileText,
  Activity,
  Settings,
} from "lucide-react";

export const appNavItems = [
  { to: "/app/home", label: "Home", icon: Home },
  { to: "/app/universe", label: "Universe", icon: Search },
  { to: "/app/pipeline", label: "Pipeline", icon: Layers },
  { to: "/app/reports", label: "Reports", icon: FileText },
  { to: "/app/runs", label: "Runs & Jobs", icon: Activity },
  { to: "/app/admin", label: "Admin", icon: Settings },
] as const;
