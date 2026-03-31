# Origination CRM – Setup and Trying the Features

The CRM layer lives in `frontend/server`: API routes under `/crm/*` and services in `frontend/server/services/crm/`. It uses **Postgres** (schema `deep_research`) for deals, contacts, emails, and interactions — the same database as the backend.

## 1. Is there a CRM frontend?

Yes. The **CRM page** at **/crm** includes:

- **Companies** — search and open a company (UUID or orgnr) for overview, contacts, drafts, send, and conversation thread.
- **Inbox** — recent inbound replies across deals (linked to Resend webhooks).
- **Unmatched** — inbound mail that could not be matched to a thread (Reply-To / token issues).
- **From My List** — pick a **My List**, generate **one AI draft per company** (requires a contact per company); review links open each company workspace.
- **External company** — create a minimal `deep_research.companies` row + contact + deal for a prospect not yet in Universe.

Use the API for automation (see table below) and tracking.

The backend also exposes REST endpoints you can call with curl or Postman (see [frontend/server/docs/crm-foundation.md](../frontend/server/docs/crm-foundation.md)).

## 2. Services to run

1. **Postgres** (existing) – for main app and Deep Research.
2. **FastAPI backend** – `http://localhost:8000` (e.g. `./scripts/start_backend.sh` or `npm run dev:backend`).
3. **Enhanced server (CRM host)** – must be running for `/crm/*` and the CRM page to work:
   - From repo root: `cd frontend && npm run dev` runs both **Vite** (port 8080) and **enhanced-server** (port 3001).
   - Or run only the server: `cd frontend && npx tsx server/enhanced-server.ts` (port 3001).

4. **Frontend (Vite)** – when you run `cd frontend && npm run dev`, the app is at `http://localhost:8080`. Vite proxies `/crm` to the enhanced server (3001), so the CRM page and API work from the same origin.

## 3. Environment variables

Set these in the **root `.env`** (or `frontend/.env.local`). The enhanced server loads root `.env` first, then `frontend/.env.local`.

### Required for CRM API and page

| Variable | Description |
|----------|-------------|
| `POSTGRES_HOST` | Postgres host (default `localhost`). |
| `POSTGRES_PORT` | Postgres port (default `5433` for local dev). |
| `POSTGRES_DB` | Database name (default `nivo`). |
| `POSTGRES_USER` | Postgres user (default `nivo`). |
| `POSTGRES_PASSWORD` | Postgres password (default `nivo`). |

Or use `DATABASE_URL=postgresql://user:pass@host:port/db` instead.

### Optional

| Variable | Description |
|----------|-------------|
| `APP_BASE_URL` | Base URL for tracking links (defaults to `http://localhost:3001`). Set to `http://localhost:8080` when using the Vite app. |
| `RESEND_API_KEY` | Resend API key (CRM outbound + Python inbound fetch). |
| `RESEND_FROM_EMAIL` | Verified From address (e.g. `hello@nivogroup.se`). Aliases: `CRM_SENDER_FROM`, `RESEND_FROM`. |
| `RESEND_REPLY_DOMAIN` | Host for structured Reply-To: `reply+<token>@<domain>` (e.g. `send.nivogroup.se` where inbound MX lives). See [email_inbound_resend.md](./email_inbound_resend.md). |
| `RESEND_WEBHOOK_SECRET` | Svix secret for `POST /webhooks/email/inbound` (FastAPI). |
| `OPENAI_API_KEY` | Already used elsewhere; needed for CRM email generation. |
| `VITE_CRM_SERVER_URL` | Override for Vite proxy target (default `http://localhost:3001`). |

Resend credentials are only needed for **sending** (`POST /crm/emails/:emailId/send`) and **inbound webhooks**. Creating deals, contacts, and generating drafts works without them.

### Resend: full inbound pipeline

See **[email_inbound_resend.md](./email_inbound_resend.md)** for Reply-To tokens, webhook URL (`POST /webhooks/email/inbound` on the FastAPI backend), env vars, and manual tests.

### Resend: DNS, inbox, and threading

- **Sending:** Add and verify your domain in [Resend Domains](https://resend.com/domains) (SPF/DKIM TXT records). Subdomains like `crm.yourdomain.com` work as **From** once verified.
- **Receiving (so replies hit Resend):** Put Resend’s **MX** (and related) records on a **subdomain** if Google Workspace or another host already owns the root domain’s MX — see [Receiving / custom domains](https://resend.com/docs/dashboard/receiving/introduction) and [Custom receiving domains](https://resend.com/docs/dashboard/receiving/custom-domains). A `send.` subdomain is often used for **outbound** return-path; **inbound** is a separate MX story — follow Resend’s wizard for the hostname you want to receive on.
- **Threading in clients:** Inbound replies use **Reply-To** `reply+<token>@RESEND_REPLY_DOMAIN` so traffic hits Resend → webhook → CRM (see [email_inbound_resend.md](./email_inbound_resend.md)). For programmatic **follow-up sends** in the same RFC thread, Resend still documents `In-Reply-To` / `References` using the inbound `message_id` — not implemented for CRM follow-ups yet.

## 4. Postgres: schema and migrations

The CRM uses the **`deep_research`** schema. Run migrations so tables exist:

- `024_deep_research_persistence.sql` – companies, company_profiles, strategy, value_creation
- `026_crm_foundation.sql` – deals, contacts, emails, interactions, tracking_events, sequences
- `047_crm_email_threads_inbound.sql` – CRM email threads + messages (Resend Reply-To)
- `049_rename_crm_email_provider_columns.sql` – renames `deep_research.emails.gmail_message_id` → `outbound_provider_message_id`, drops unused `gmail_thread_id`
- `032_company_identity_and_prospects_crm_link.sql` – company identity view, prospects↔CRM link

Run: `./scripts/run_postgres_migrations.sh` or apply migrations manually.

**Company identity:** `orgnr` bridges `public.companies` and `deep_research.companies`. `GET /crm/company/:companyId` accepts either UUID or orgnr.

**Outbound id column:** After migration `049`, sent Resend message ids are stored in `emails.outbound_provider_message_id` (not legacy Gmail column names).

## 5. Quick check

1. Set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` in `.env` (or use defaults for local dev).
2. Start Postgres (e.g. `docker compose -f docker-compose.postgres.yml up -d`).
3. Run migrations if not already applied.
4. Start enhanced server + frontend: `cd frontend && npm run dev`.
5. Open `http://localhost:8080/crm`.
6. Enter a company UUID from `deep_research.companies` and click "Load overview" to test `GET /crm/company/:companyId`.

If the overview fails with "Database client unavailable" or 500, check the enhanced server console and confirm Postgres is running and credentials are correct.

## 6. API overview

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/crm/deals/from-company` | Create or get deal by company ID. |
| POST | `/crm/companies` | Create minimal company (ad-hoc / external prospect); optional `orgnr`, `website`. |
| GET | `/crm/company/:companyId` | Company CRM overview (deal, contacts, emails, timeline). |
| POST | `/crm/contacts` | Create contact. |
| PATCH | `/crm/contacts/:contactId` | Update contact. |
| POST | `/crm/emails/generate` | Generate draft (uses OpenAI). |
| POST | `/crm/emails/generate-batch` | Body: `{ list_id }` — one draft per list orgnr (skips companies without contact). |
| POST | `/crm/emails/:emailId/approve` | Mark draft approved. |
| POST | `/crm/emails/:emailId/send` | Send via Resend (`RESEND_*`, `RESEND_REPLY_DOMAIN`). |
| GET | `/crm/email-config` | Returns `{ resend_configured, missing[] }` (no secrets). |
| GET | `/crm/inbound/recent` | Recent inbound messages (CRM inbox). |
| GET | `/crm/inbound/unmatched` | Unmatched inbound rows. |
| POST | `/crm/deals/:dealId/notes` | Add note. |
| POST | `/crm/deals/:dealId/status` | Update deal status. |
| GET | `/crm/deals/:dealId/timeline` | Timeline for deal. |
| POST | `/crm/deals/:dealId/enroll-sequence` | Enroll deal in sequence. |

Tracking: `/track/open/:trackingId`, `/track/click/:trackingId` (used in email links).

See [frontend/server/docs/crm-foundation.md](../frontend/server/docs/crm-foundation.md) for more detail.

## 7. Private email smoke test (send, reply, tracking)

Use a **personal test address** as the CRM contact email to verify deliverability without contacting real prospects.

1. **Send:** Approve and send a short test message; confirm it arrives in your inbox and `Reply-To` is `reply+<token>@<RESEND_REPLY_DOMAIN>`.
2. **Reply:** Reply from that mailbox so the message hits Resend receiving → FastAPI webhook `POST /webhooks/email/inbound`, then check **Inbox** / **Conversation** in `/crm`.
3. **Open / click:** Open the email (images on) and click a tracked `https` link; confirm interactions / timeline counts.

If inbound fails, verify Resend receiving, DNS, and that the FastAPI backend URL is reachable from Resend (tunnel for local dev). See [email_inbound_resend.md](./email_inbound_resend.md).
