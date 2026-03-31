# Origination CRM Foundation (v1)

This module adds a CRM layer on top of `deep_research` company intelligence data.

## Environment variables

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or `CRM_SENDER_FROM` / `RESEND_FROM`), `RESEND_REPLY_DOMAIN`
- `RESEND_WEBHOOK_SECRET` (FastAPI inbound webhook — see [email_inbound_resend.md](../../../docs/email_inbound_resend.md))
- `OPENAI_API_KEY`
- `APP_BASE_URL`
- `DATABASE_URL` or `POSTGRES_HOST` / `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` (same Postgres as the rest of the stack)

CRM outbound email uses **Resend only** (`frontend/server/services/resend/resend-email.service.ts`).

## Flow

1. `POST /crm/deals/from-company`
2. `POST /crm/contacts`
3. `POST /crm/emails/generate`
4. `POST /crm/emails/:emailId/approve`
5. `POST /crm/emails/:emailId/send` (Resend)
6. Track engagement using `/track/open/:trackingId` and `/track/click/:trackingId`

## Notes

- Draft generation uses existing deep research context from `company_profiles`, `strategy`, and `value_creation`.
- All key actions are written to `deep_research.interactions`.
