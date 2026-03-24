# Origination CRM Foundation (v1)

This module adds a CRM layer on top of `deep_research` company intelligence data.

## Environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`
- `OPENAI_API_KEY`
- `APP_BASE_URL`
- `DATABASE_URL` or `POSTGRES_HOST` / `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` (same Postgres as the rest of the stack)

## Flow

1. `POST /crm/deals/from-company`
2. `POST /crm/contacts`
3. `POST /crm/emails/generate`
4. `POST /crm/emails/:emailId/approve`
5. `POST /crm/emails/:emailId/send`
6. Track engagement using `/track/open/:trackingId` and `/track/click/:trackingId`

## Notes

- Draft generation uses existing deep research context from `company_profiles`, `strategy`, and `value_creation`.
- All key actions are written to `deep_research.interactions`.
- Gmail sync replies are scaffolded in `services/gmail/gmail-sync.service.ts` for later implementation.
