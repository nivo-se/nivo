import { fetchWithAuth } from "@/lib/backendFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export type CompanyLabel = {
  label: string;
  scope: "private" | "team";
  created_by: string;
  created_at: string;
};

export async function getLabels(orgnr: string, scope?: "private" | "team" | "all"): Promise<{ labels: CompanyLabel[] }> {
  const qs = scope ? `?scope=${scope}` : "";
  const res = await fetchWithAuth(`${API_BASE}/api/labels/${encodeURIComponent(orgnr)}${qs}`);
  if (!res.ok) throw new Error("Failed to fetch labels");
  return res.json();
}

export async function addLabel(orgnr: string, payload: { label: string; scope?: "private" | "team" }): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/labels/${encodeURIComponent(orgnr)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: payload.label, scope: payload.scope ?? "private" }),
  });
  if (!res.ok) throw new Error("Failed to add label");
}

export async function removeLabel(orgnr: string, label: string, scope: "private" | "team"): Promise<void> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/labels/${encodeURIComponent(orgnr)}?label=${encodeURIComponent(label)}&scope=${scope}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to remove label");
}
