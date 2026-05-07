/** Shared CRM display helpers (deal status, dates). */

export function formatCrmDealStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatCrmShortDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** One-line summary for CRM thread message counts (dashboard table + mobile). */
export function formatCrmCorrespondenceShort(total: number, inbound: number): string {
  const t = Number(total) || 0;
  const i = Number(inbound) || 0;
  if (t <= 0) return "No emails yet";
  const noun = t === 1 ? "email" : "emails";
  return `${t} ${noun} · ${i} inbound`;
}
