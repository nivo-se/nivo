# Deploy Nivo on Mac mini (LAN)

Postgres and the API run **on the same machine (the mini)** using this repo’s `docker-compose.yml`. No separate Postgres host or shared container.

**Quick start:** On the mini: clone into `/srv/nivo`, `cp .env.example .env`, set `POSTGRES_PASSWORD` (and any other secrets), then `docker compose up -d --build`. The compose file starts Postgres and the API; the API connects to Postgres by service name (`postgres:5432`).

For **local dev on your Mac**, use `docker-compose.postgres.yml` for Postgres and run the API locally (e.g. `uvicorn` with `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433`).

---

## 1. Folder structure on the mini

```
/srv/nivo/                  # This project
├── .env                    # Real secrets (not in git)
├── .env.example            # From repo
├── docker-compose.yml      # Postgres + API
└── ...                     # Rest from git clone
```

---

## 2. This project’s Docker Compose

- **Postgres + API** in one `docker-compose.yml`. Both use the `nivo_net` network.
- The API container is given `POSTGRES_HOST=postgres` and `POSTGRES_PORT=5432` by the compose file, so it talks to the Postgres service on the same host. You do **not** need to set `POSTGRES_HOST` in `.env` on the mini for the API; set `POSTGRES_PASSWORD` (and optionally `POSTGRES_DB` / `POSTGRES_USER`) for the Postgres service and for any tools that use the same `.env`.
- **Secrets:** use a real `.env` (from `.env.example`); do not commit `.env`.

---

## 3. DB migration: this Mac → mini (one-time)

Source: **this Mac** (current Postgres, e.g. `localhost:5433`).  
Target: **mini** — Postgres started by this repo’s compose (database name from `POSTGRES_DB`, default `nivo`).

### 3.1 On this Mac: dump the current DB

```bash
pg_dump -h localhost -p 5433 -U nivo -d nivo -F c -f nivo_dump.dump
# Or plain SQL:
pg_dump -h localhost -p 5433 -U nivo -d nivo --no-owner --no-acl -f nivo_dump.sql
```

### 3.2 On the mini: start Postgres, then restore

1. Clone and create `.env` (see §4). Set at least `POSTGRES_PASSWORD` (and `POSTGRES_DB`/`POSTGRES_USER` if you changed them).
2. Start the stack so Postgres is running (and creates the empty DB):
   ```bash
   cd /srv/nivo
   docker compose up -d --build
   ```
3. Copy the dump to the mini (e.g. `scp nivo_dump.dump mini:/tmp/`).
4. Restore into the **nivo-pg** container (default DB name `nivo`):

   **Binary dump:**
   ```bash
   docker cp /tmp/nivo_dump.dump nivo-pg:/tmp/
   docker exec -i nivo-pg pg_restore -U nivo -d nivo --no-owner --no-acl /tmp/nivo_dump.dump
   ```

   **Plain SQL:**
   ```bash
   docker cp /tmp/nivo_dump.sql nivo-pg:/tmp/
   docker exec -i nivo-pg psql -U nivo -d nivo -f /tmp/nivo_dump.sql
   ```

5. If you use schema migrations, run them against the restored DB (e.g. `docker compose run --rm api python -m scripts.run_migrations_or_equivalent`). Adjust to your migration command.

---

## 4. Deployment steps

### 4.1 One-time setup on the mini

```bash
sudo mkdir -p /srv/nivo
sudo chown "$USER" /srv/nivo
cd /srv/nivo
git clone https://github.com/YOUR_ORG/nivo.git .
cp .env.example .env
```

Edit `.env`: set **POSTGRES_PASSWORD** (required). Optionally set `POSTGRES_DB`, `POSTGRES_USER`, and other vars (OpenAI, Supabase, etc.). The API’s connection to Postgres is set by the compose file (`postgres:5432`).

If you are migrating from this Mac, run the dump/restore steps in §3, then:

```bash
docker compose up -d --build
```

If this is a fresh install with no existing DB, just:

```bash
docker compose up -d --build
```

Then run migrations if your project uses them.

### 4.2 Future updates (code / config)

```bash
cd /srv/nivo
git pull
docker compose up -d --build
```

This rebuilds and restarts the API; Postgres keeps running and keeps its data (in volume `nivo_pg_data`). To restart Postgres too: `docker compose up -d --build` restarts all services.

---

## 5. Ports and security

- **Postgres:** Not exposed on the host by default. Only the API container (on `nivo_net`) can connect. To run migrations or `pg_dump` from the mini host, you can temporarily add `ports: ["127.0.0.1:5432:5432"]` to the `postgres` service in `docker-compose.yml`.
- **FastAPI:** Exposed on port 8000. Later you can put **Cloudflare Tunnel** (or similar) in front so the outside world sees only `api.<domain>`.

---

## 6. Command checklist

### One-time migration (this Mac → mini)

```bash
# On this Mac
pg_dump -h localhost -p 5433 -U nivo -d nivo --no-owner --no-acl -f nivo_dump.sql
# Copy to mini: scp nivo_dump.sql mini:/tmp/

# On the mini (after clone + .env + first docker compose up -d)
docker cp /tmp/nivo_dump.sql nivo-pg:/tmp/
docker exec -i nivo-pg psql -U nivo -d nivo -f /tmp/nivo_dump.sql
```

### One-time deploy on the mini

```bash
sudo mkdir -p /srv/nivo && sudo chown "$USER" /srv/nivo
cd /srv/nivo
git clone https://github.com/YOUR_ORG/nivo.git .
cp .env.example .env
# Edit .env: at least POSTGRES_PASSWORD and other secrets

docker compose up -d --build
```

### Ongoing deploys

```bash
cd /srv/nivo
git pull
docker compose up -d --build
```

---

## 7. Summary

| Step | Action |
|------|--------|
| **Postgres** | Runs on the mini in the same compose as the API (service name `postgres`, container `nivo-pg`). |
| **API** | Connects to `postgres:5432` (set in compose). No need to set `POSTGRES_HOST` in `.env` on the mini. |
| **One-time migration** | Dump on this Mac → copy to mini → restore into `nivo-pg` (see §3). |
| **One-time deploy** | Clone into `/srv/nivo`, `cp .env.example .env`, set `POSTGRES_PASSWORD` and secrets, `docker compose up -d --build`. |
| **Ongoing deploys** | `git pull` + `docker compose up -d --build`. |
