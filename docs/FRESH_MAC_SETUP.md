# Fresh Mac Setup

One-command setup for a new Mac. Run from the repo root.

## Quick start

```bash
cd /path/to/nivo
./scripts/setup_fresh_mac.sh
```

Or via npm:

```bash
cd /path/to/nivo
npm run setup:fresh
```

## Prerequisites (install first)

| Tool | Install |
|------|---------|
| Node.js | `brew install node` |
| Python 3 | `brew install python@3.12` |
| Docker | Install [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/) |
| Redis | `brew install redis && brew services start redis` |
| psql (optional) | `brew install libpq` — migrations work without it using Python |

## What the script does

1. Checks prerequisites (node, npm, python3, docker, redis-cli)
2. Installs npm deps (root + frontend)
3. Creates backend venv and installs Python deps
4. Copies `.env.example` → `.env` if missing
5. Starts Postgres (Docker) and applies schema + migrations

## After setup

1. **Edit `.env`** — set `POSTGRES_PASSWORD`, `OPENAI_API_KEY`, `SUPABASE_*`, `REDIS_URL`
2. **Start backend:** `npm run dev:backend`
3. **Start frontend:** `npm run dev`
4. (Optional) Import data: `python3 scripts/migrate_sqlite_to_postgres.py --truncate`

## Copy-paste commands (run one at a time)

```bash
cd /path/to/nivo
```

```bash
brew install node python@3.12 libpq redis
```

```bash
brew services start redis
```

```bash
./scripts/setup_fresh_mac.sh
```

Then edit `.env` in your editor and start the servers.
