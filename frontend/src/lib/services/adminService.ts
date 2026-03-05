import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

/** Role in local Postgres (user_roles). */
export type UserRole = "admin" | "analyst";

export interface UserRoleRow {
  sub: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AllowedUserRow {
  sub: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUsersResponse {
  user_roles: UserRoleRow[];
  allowed_users: AllowedUserRow[];
}

/** List all user_roles and allowed_users. Admin only. */
export async function getAdminUsers(): Promise<AdminUsersResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/users`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { detail?: string }).detail ||
      (err as { message?: string }).message ||
      "Failed to load users";
    throw new Error(msg);
  }
  return res.json();
}

/** Set role for user by sub. Admin only. */
export async function setUserRole(sub: string, role: UserRole): Promise<{ sub: string; role: string }> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/users/${encodeURIComponent(sub)}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { detail?: string }).detail ||
      (err as { message?: string }).message ||
      "Failed to set role";
    throw new Error(msg);
  }
  return res.json();
}

/** Set allowlist entry for sub. Admin only. */
export async function setUserAllow(
  sub: string,
  enabled: boolean,
  note?: string | null
): Promise<{ sub: string; enabled: boolean; note?: string | null }> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/users/${encodeURIComponent(sub)}/allow`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, note: note ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { detail?: string }).detail ||
      (err as { message?: string }).message ||
      "Failed to update allowlist";
    throw new Error(msg);
  }
  return res.json();
}

// --- AI credits (admin): spend limits and per-user usage ---

export interface AICreditsConfig {
  global_monthly_limit_usd: number;
  per_user_monthly_limit_usd: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AICreditsUserUsage {
  user_id: string;
  total_usd: number;
  operation_counts: Record<string, number>;
}

export interface AICreditsUsageResponse {
  period: string;
  global_total_usd: number;
  per_user: AICreditsUserUsage[];
  config: AICreditsConfig;
}

export async function getAiCreditsConfig(): Promise<AICreditsConfig> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/ai-credits/config`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to load AI credits config");
  }
  return res.json();
}

export async function updateAiCreditsConfig(updates: {
  global_monthly_limit_usd?: number;
  per_user_monthly_limit_usd?: number | null;
}): Promise<AICreditsConfig> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/ai-credits/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to update config");
  }
  return res.json();
}

export async function getAiCreditsUsage(period: string = "current_month"): Promise<AICreditsUsageResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/admin/ai-credits/usage?period=${encodeURIComponent(period)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to load usage");
  }
  return res.json();
}
