# Local Postgres Setup (Docker)

Local development Postgres for the Nivo backend. Uses Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Port 5433 on host is used (mapped to container 5432). If you prefer 5432, stop any local Postgres first and change `docker-compose.yml` to `"5432:5432"`.

## Start Postgres

```bash
docker compose up -d
```

## Verify

```bash
# Container running
docker ps

# Healthcheck and logs
docker logs nivo-pg

# Connect (container uses internal 5432)
docker exec -it nivo-pg psql -U nivo -d nivo -c "SELECT 1;"

# Or from host (port 5433):
python3 scripts/check_postgres_connection.py
```

## Stop

```bash
docker compose down
```

## Data persistence

Data is stored in the `nivo_pg_data` volume. To reset:

```bash
docker compose down -v
```

## Connection check

```bash
python3 scripts/check_postgres_connection.py
```

## Full runbook (copy/paste)

```bash
# 1. Start Postgres
docker compose up -d

# 2. Set Postgres as DB source (add to .env: DATABASE_SOURCE=postgres, POSTGRES_PORT=5433)
export DATABASE_SOURCE=postgres

# 3. Bootstrap schema
python3 scripts/bootstrap_postgres_schema.py

# 4. Migrate data from SQLite
python3 scripts/migrate_sqlite_to_postgres.py --truncate

# 5. Verify connection and smoke test
python3 scripts/check_postgres_connection.py
python3 scripts/smoke_test_postgres_mode.py

# 6. Start backend
cd backend && uvicorn api.main:app --host 0.0.0.0 --port 8000
```

See [LOCAL_POSTGRES_BOOTSTRAP.md](./LOCAL_POSTGRES_BOOTSTRAP.md) and [POSTGRES_MIGRATION_VALIDATION.md](./POSTGRES_MIGRATION_VALIDATION.md).
