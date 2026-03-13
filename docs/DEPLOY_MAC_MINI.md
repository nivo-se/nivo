# Deploy Nivo on Mac mini (LAN)

Postgres and the API run **on the same machine (the mini)** using this repo’s `docker-compose.yml`. No separate Postgres host or shared container.

**Quick start:** On the mini: clone into `/srv/nivo`, `cp .env.example .env`, set `POSTGRES_PASSWORD` (and any other secrets), then `docker compose up -d --build`. The compose file starts Postgres and the API; the API connects to Postgres by service name (`postgres:5432`).

For **local dev on your Mac**, use `docker-compose.postgres.yml` for Postgres and run the API locally (e.g. `uvicorn` with `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433`).

---

## After you push to GitHub and merge to main

There is **no automated deploy**. The Mac Mini does not pull from GitHub by itself.

1. **On the Mac Mini** (e.g. SSH in): go to the repo and pull the latest:
   ```bash
   cd /srv/nivo
   git pull
   docker compose up -d --build
   ```
2. **The Mac Mini keeps its own `.env`** in `/srv/nivo/.env`. That file is **not in git** (and must not be). You create it once from `.env.example` and edit it on the mini with production secrets (e.g. `POSTGRES_PASSWORD`, OpenAI, Auth0). When you `git pull`, `.env` is untouched, so the mini keeps using the same DB (Postgres in Docker on the mini) and the same secrets.
3. **DB connection on the mini:** The API runs **inside** Docker and gets `POSTGRES_HOST=postgres` and `POSTGRES_PORT=5432` from `docker-compose.yml` (overrides in the compose file), so it talks to the Postgres container on the same host. You do **not** need `DATABASE_URL` or `POSTGRES_HOST` in the mini’s `.env` for the API; the compose file sets them. You only need `POSTGRES_PASSWORD` (and optionally `POSTGRES_DB` / `POSTGRES_USER`) for the Postgres service and for any host-side tools (e.g. migrations, pg_dump).

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

- **Postgres:** Exposed on `0.0.0.0:5433` on the host (maps to container 5432) so you can run migrations from the mini host and connect from your dev machine (see §5a).
- **FastAPI:** Exposed on port 8000. Later you can put **Cloudflare Tunnel** (or similar) in front so the outside world sees only `api.<domain>`.

### 5a. Connecting to the DB from your laptop (home and office)

The DB lives on the Mac mini on your private LAN. To use it from your dev machine in both locations:

- **At home (same LAN):** Use the mini’s LAN IP as `POSTGRES_HOST` in your local `.env`, e.g. `192.168.1.50`. Find it on the mini with `ipconfig getifaddr en0` (or System Settings → Network).
- **At office (different network):** Use a private overlay so the mini is reachable without opening ports. Recommended: **Tailscale**.
  1. Install [Tailscale](https://tailscale.com) on the Mac mini and on your laptop; sign in with the same account.
  2. On the mini, note its Tailscale IP (e.g. `100.x.x.x`) in the Tailscale admin or with `tailscale ip -4`.
  3. On your laptop, use that IP as `POSTGRES_HOST` when at the office (or use it everywhere so one config works at home and office).

**Example `.env` on your laptop** (one config for both locations if you use Tailscale):

```bash
DATABASE_SOURCE=postgres
# Use mini's Tailscale IP so it works from home and office
POSTGRES_HOST=100.x.x.x   # replace with mini's Tailscale IP
POSTGRES_PORT=5433
POSTGRES_DB=nivo
POSTGRES_USER=nivo
POSTGRES_PASSWORD=your_mini_postgres_password
DATABASE_URL=postgresql://nivo:your_mini_postgres_password@100.x.x.x:5433/nivo
```

If you prefer to use the mini’s LAN IP when at home (e.g. lower latency), you can switch `POSTGRES_HOST` between the LAN IP and the Tailscale IP depending on where you are, or use the Tailscale IP everywhere for simplicity.

**Security:** Postgres is only reachable on your LAN and (with Tailscale) over Tailscale’s encrypted mesh. Restrict port 5433 to LAN/Tailscale in the mini’s firewall if you want an extra layer.

### 5b. AI runs / “Recent Runs” not showing

The list comes from the `acquisition_runs` table, created by migration `018_create_analysis_tables.sql`. If migrations haven’t been run on the Mac Mini, the table doesn’t exist and the API returns an empty list (no error, just no runs).

**What to do on the Mac Mini**

1. Run Postgres migrations (from your repo directory, e.g. `~/nivo-web` or `/srv/nivo`):

   ```bash
   cd /srv/nivo
   export DATABASE_URL="postgresql://nivo:YOUR_POSTGRES_PASSWORD@127.0.0.1:5433/nivo"
   ./scripts/run_postgres_migrations.sh
   ```

   Replace `YOUR_POSTGRES_PASSWORD` with the value of `POSTGRES_PASSWORD` from your `.env`.

2. Restart the API (optional, for a clean state):

   ```bash
   docker compose up -d --build
   ```

3. Reload the app in the browser; “Recent Runs” / AI runs should show (existing runs if any, or empty until you start new ones).

**If migrations fail:** The script expects the base schema to exist (e.g. `companies`). If your Mini DB was created only from a dump, that’s usually enough. If you get “relation does not exist” for something like `companies`, run the bootstrap once against the same DB:

   ```bash
   export DATABASE_URL="postgresql://nivo:YOUR_POSTGRES_PASSWORD@127.0.0.1:5433/nivo"
   python scripts/bootstrap_postgres_schema.py
   ```

   Then run `./scripts/run_postgres_migrations.sh` again.

### 5c. AI analysis runs but produces no data (finishes too fast)

If analysis completes almost instantly with empty results, the LLM calls are likely failing. Common causes:

1. **`OPENAI_API_KEY` not set or invalid** — The API uses OpenAI (api.openai.com) by default. Ensure `.env` on the Mac Mini has a real key:
   ```
   OPENAI_API_KEY=sk-proj-...   # Real key from platform.openai.com
   ```
   If you use a placeholder (e.g. from `.env.example`), the API will return 401 and analysis will fail silently per company.

2. **Check API logs** — On the mini:
   ```bash
   docker logs nivo-api --tail 100
   ```
   Look for `Failed to persist` or OpenAI/auth errors.

3. **Local/alternative LLM** — To use LM Studio, Azure OpenAI, or another OpenAI-compatible endpoint, set in `.env`:
   ```
   LLM_BASE_URL=http://localhost:1234/v1   # or your endpoint
   LLM_API_KEY=lm-studio                    # or your key
   ```

4. **Restart after changing .env:**
   ```bash
   docker compose up -d --build
   ```

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
