import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun, Monitor } from "lucide-react";

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemeValue; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AdminSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <Card className="new-card">
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <p className="text-sm text-gray-700">Appearance and preferences</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select
            value={theme ?? "system"}
            onValueChange={(v) => setTheme(v as ThemeValue)}
          >
            <SelectTrigger id="theme" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-600">
            Current: {resolvedTheme ?? "system"} — affects UI components and
            toasts
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
