# Origination CRM Foundation (v1)

This module adds a CRM layer on top of `deep_research` company intelligence data.

## Environment variables

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or `CRM_SENDER_FROM` / `RESEND_FROM`); `RESEND_REPLY_DOMAIN` optional (defaults to the domain part of From — see `services/resend/crm-resend-env.ts`)
- `RESEND_WEBHOOK_SECRET` (FastAPI inbound webhook — see [email_inbound_resend.md](../../../docs/email_inbound_resend.md))
- `OPENAI_API_KEY`
- `APP_BASE_URL`
- `DATABASE_URL` or `POSTGRES_HOST` / `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` (same Postgres as the rest of the stack)

CRM outbound email uses **Resend only** (`frontend/server/services/resend/resend-email.service.ts`).

## Flow

1. `POST /crm/deals/from-company`
2. `POST /crm/contacts` (or `POST /crm/companies` for an ad-hoc company, then contact + deal)
3. `POST /crm/emails/generate` (single) or `POST /crm/emails/generate-batch` (My List → one draft per company)
4. `POST /crm/emails/:emailId/approve`
5. `POST /crm/emails/:emailId/send` (Resend)
6. Track engagement using `/track/open/:trackingId` and `/track/click/:trackingId`
7. Inbound: `GET /crm/inbound/recent`, `GET /crm/inbound/unmatched`, `GET /crm/email-config`

## Notes

- Draft generation uses existing deep research context from `company_profiles`, `strategy`, and `value_creation`.
- All key actions are written to `deep_research.interactions`.
