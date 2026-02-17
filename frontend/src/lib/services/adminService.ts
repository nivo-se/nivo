import { fetchWithAuth } from "@/lib/backendFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
