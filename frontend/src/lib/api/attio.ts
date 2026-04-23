/**
 * Attio integration client — calls FastAPI (`backend/api/attio.py`), NOT the
 * Node enhanced server.
 *
 * Surface is intentionally tiny: one ad-hoc push per company. There is no
 * "list", "search", or "get" — Attio is the source of truth, Nivo only writes.
 * If you find yourself adding a read endpoint here, stop and reconsider.
 */
import { ApiRequestError, requestJson } from "./httpClient";

export interface SendCompanyResult {
  ok: boolean;
  company_record_id: string | null;
  company_attio_url: string | null;
  contacts_pushed: number;
  contacts_total: number;
  notes_appended: number;
  errors: string[];
}

export interface AttioSyncDisabledError {
  kind: "disabled";
  message: string;
}

/**
 * Push the given company (and its contacts + latest research summary) into
 * Attio. Idempotent: re-running just refreshes Attio with the latest values.
 *
 * Throws `ApiRequestError` on HTTP errors. Caller should special-case 503
 * (Attio sync disabled) to render the "set ATTIO_SYNC_ENABLED" hint.
 */
export async function sendCompanyToAttio(
  companyId: string
): Promise<SendCompanyResult> {
  return requestJson<SendCompanyResult>(
    `/api/attio/send-company/${encodeURIComponent(companyId)}`,
    { method: "POST" }
  );
}

export function isAttioDisabledError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 503;
}
