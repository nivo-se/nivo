import { fetchWithAuth } from "@/lib/backendFetch";
import { API_BASE } from "@/lib/apiClient";

export type UserRole = "pending" | "approved" | "admin";

export async function createUser(
  email: string,
  password: string,
  role: UserRole,
  options?: { first_name?: string; last_name?: string }
): Promise<{ user_id: string; email: string; role: string; message: string }> {
  const body: Record<string, unknown> = { email, password, role };
  if (options?.first_name != null) body.first_name = options.first_name;
  if (options?.last_name != null) body.last_name = options.last_name;
  const res = await fetchWithAuth(`${API_BASE}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { detail?: string }).detail ||
      (err as { message?: string }).message ||
      "Failed to create user";
    throw new Error(msg);
  }

  return res.json();
}

export async function updateUserProfile(
  userId: string,
  profile: { first_name?: string | null; last_name?: string | null }
): Promise<{ message: string }> {
  const body: Record<string, string | null> = {};
  if (profile.first_name !== undefined) body.first_name = profile.first_name ?? null;
  if (profile.last_name !== undefined) body.last_name = profile.last_name ?? null;

  const res = await fetchWithAuth(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { detail?: string }).detail ||
      (err as { message?: string }).message ||
      "Failed to update name";
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
