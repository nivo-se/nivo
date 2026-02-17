import { API_BASE } from "@/lib/apiClient";

export type WhoAmI = {
  api_base: string;
  port: number;
  database_source: string;
  db_host: string;
  db_port: string;
  git_sha: string;
  started_at: string;
};

export async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch(`${API_BASE}/api/debug/whoami`);
  if (!res.ok) throw new Error(`whoami failed: ${res.status}`);
  return res.json();
}
