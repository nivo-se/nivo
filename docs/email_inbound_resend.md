# CRM email: Resend outbound + inbound replies

## Architecture

- **Outbound:** The enhanced Node server (`frontend/server`) sends CRM mail via **Resend** (only). Each deal/contact pair has at most one **thread** row (`deep_research.crm_email_threads`) with an opaque **32-hex token**.
- **Reply-To:** Every outbound send uses  
  `reply+<token>@<RESEND_REPLY_DOMAIN>`  
  (e.g. `send.nivogroup.se` on the same verified subdomain as receiving). Recipients’ replies go to that address, not to Google Workspace.
- **Inbound:** Resend receives mail on the configured receiving domain and POSTs `email.received` to the FastAPI backend at **`POST /webhooks/email/inbound`**. The handler verifies the Svix signature, loads full content via **GET** `https://api.resend.com/emails/receiving/{email_id}`, resolves the token to a thread, and inserts **`crm_email_messages`** (inbound). Unmatched mail is stored in **`crm_email_inbound_unmatched`**. A **`reply_received`** interaction is created on success (not on duplicates).

Human company mail stays on **Google Workspace** (root MX unchanged). Only the Reply-To path uses the inbound subdomain.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (Node send + Python fetch received body). |
| `RESEND_FROM_EMAIL` | Verified From address (e.g. `hello@nivogroup.se`). Aliases: `CRM_SENDER_FROM`, `RESEND_FROM`. |
| `RESEND_REPLY_DOMAIN` | Hostname for Reply-To only (e.g. `send.nivogroup.se`). Must match the host where Resend’s **inbound** MX is set (avoid a second MX on `reply.send` if that breaks verification). |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret from Resend **Webhooks** (same value Resend shows for verifying payloads). |
| `ENVIRONMENT` / `APP_ENV` | `production` / `staging` require webhook secret; development may use `RESEND_WEBHOOK_VERIFY_DISABLED=true` if secret unset (local only). |
| `RESEND_WEBHOOK_VERIFY_DISABLED` | `true` only for local testing without `RESEND_WEBHOOK_SECRET` (never in production). |
| Postgres `DATABASE_URL` or `POSTGRES_*` | Same DB for Node CRM and Python webhook. |

## Webhook URL

Configure in Resend:

- **URL:** `https://api.nivogroup.se/webhooks/email/inbound`
- **Event:** `email.received`

## Reply-To convention

- Format: `reply+<thread_token>@<RESEND_REPLY_DOMAIN>`
- Token: **32 lowercase hex characters** (128-bit random), stored in `crm_email_threads.token`.

## Manual testing

1. Apply migration `047_crm_email_threads_inbound.sql`.
2. Set env vars (including `RESEND_REPLY_DOMAIN`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`).
3. Send an approved CRM email via `POST /crm/emails/:id/send`.
4. Inspect the sent message: **From** = `RESEND_FROM_EMAIL`, **Reply-To** = `reply+<token>@…`.
5. Reply from an external mailbox; confirm Resend shows delivery and the webhook returns 200.
6. Query `crm_email_messages` for `direction = 'inbound'` and the expected `thread_id`.
7. Replay the webhook; confirm duplicate ignored (`dedupe_key` = `resend:received:<email_id>`).

## API: list messages in a thread

- `GET /crm/email-threads/:threadId/messages` — returns rows from `crm_email_messages` (enhanced server).

## Known limitations

- Full webhook + Svix tests need FastAPI/Starlette installed (e.g. project venv); repo includes lightweight **parse-only** unit tests under `backend/tests/unit/test_crm_email_inbound.py`.
- `RESEND_API_KEY` must be allowed to **retrieve received emails**; a send-only restricted key may fail inbound fetch.
- Inbound processing is synchronous in the webhook request (no queue); keep handler fast; Resend retries on non-2xx.

## Related code

- Node: `frontend/server/services/crm/reply-to-address.ts`, `emails.service.ts`, `resend/resend-email.service.ts`, `postgres-db.ts`
- Python: `backend/api/email_webhooks.py`, `backend/services/crm_email_inbound/`
