# Local Postgres Schema Bootstrap

Creates tables, indexes, and views in local Postgres for Nivo development.

## Prerequisites

1. Postgres running (see [LOCAL_POSTGRES_SETUP.md](./LOCAL_POSTGRES_SETUP.md)). Verify: `python3 scripts/check_postgres_connection.py`

   ```bash
   docker compose up -d
   ```

2. Env vars set (e.g. from `.env`):

   ```
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5433
   POSTGRES_DB=nivo
   POSTGRES_USER=nivo
   POSTGRES_PASSWORD=nivo
   ```

## Run

From the repo root:

```bash
python3 scripts/bootstrap_postgres_schema.py
```

## Expected output

```
Connecting to Postgres at localhost:5433/nivo...
Applying 25 statements from local_postgres_schema.sql...
✅ Bootstrap complete. 25 statements applied successfully.
```

## Schema source

`database/local_postgres_schema.sql` – tables: companies, financials, company_kpis, company_metrics (view), ai_profiles, ai_queries, saved_company_lists.

## Next step: migrate data

```bash
python3 scripts/migrate_sqlite_to_postgres.py --truncate
```

Then set `DATABASE_SOURCE=postgres` in `.env` and start the backend:

```bash
cd backend && uvicorn api.main:app --host 0.0.0.0 --port 8000
```
