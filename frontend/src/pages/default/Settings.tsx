import { AdminSettings } from "@/components/AdminSettings";

export default function Settings() {
  return (
    <div className="h-full overflow-auto app-bg">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-foreground mb-2">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Appearance and preferences
          </p>
        </div>
        <AdminSettings />
      </div>
    </div>
  );
}
