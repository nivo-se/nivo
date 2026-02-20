# Nivo development workflow

How to develop on different Macs, push to GitHub, and deploy to local servers + Vercel.

---

## Stack overview

| Part | Where it runs | Tech |
|------|---------------|------|
| **Frontend** | Vercel (prod) or local `npm run dev` | Vite + React |
| **API** | Mac mini (prod) or local Docker | FastAPI in Docker |
| **Postgres** | Mac mini or local Docker | PostgreSQL 16 |
| **Tunnel** | Mac mini | Cloudflare Tunnel → api.nivogroup.se |

---

## 1. One-time setup (each Mac)

### 1.1 Clone the repo

```bash
git clone https://github.com/YOUR_ORG/nivo-web.git
cd nivo-web
```

### 1.2 Environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Edit `.env` and `frontend/.env` with your values (see `.env.example` comments). **Never commit `.env`** — it's in `.gitignore`.

### 1.3 Install dependencies

```bash
npm install
npm run dev
```

This installs root + frontend deps and starts the Vite dev server. For backend work:

```bash
docker compose up -d
```

### 1.4 Mac mini (production API host)

On the Mac mini only, you also need:

- Cloudflare tunnel (see [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md))
- LaunchAgent for tunnel so it survives logout
- Same `.env` as other Macs (clone from repo, copy `.env` manually or via secure channel)

---

## 2. Daily development

### Develop on Mac A or Mac B

```bash
git pull
npm install
npm run dev
```

- **Frontend:** `http://localhost:5173` (Vite)
- **API:** either
  - `VITE_API_BASE_URL=https://api.nivogroup.se` in `frontend/.env` → use production API
  - or `VITE_API_BASE_URL=http://127.0.0.1:8000` + `docker compose up -d` → use local API

### Backend changes

```bash
docker compose up -d --build
```

Rebuilds the API image and restarts the container. Migrations:

```bash
cat database/migrations/020_user_roles_allowed_users.sql | docker compose exec -T postgres psql -U nivo -d nivo -v ON_ERROR_STOP=1
```

Or run all migrations (if `psql` is installed):

```bash
./scripts/run_postgres_migrations.sh
```

If `psql` is not installed, pipe each migration via Docker (see scripts in repo).

---

## 3. Git workflow → GitHub

### Branch strategy (recommended)

- **main** — production; Vercel deploys from here.
- **Feature branches** — e.g. `mini-setup`, `fix-lists`, etc. Push to GitHub for review, then merge to `main`.

### Push changes

```bash
git status
git add .
git commit -m "feat: add X / fix Y"
git push origin <branch-name>
```

### Merge to main

When you're happy with a branch:

```bash
git checkout main
git pull
git merge <branch-name>
git push origin main
```

- **Vercel** auto-deploys `main` (and previews for other branches if configured).
- **Mac mini** needs a manual pull + rebuild (see §4).

---

## 4. Deploying to Mac mini (local servers)

SSH into the Mac mini (or sit at it) and run:

```bash
cd /srv/nivo   # or your deploy path
git pull
docker compose up -d --build
```

This updates the API. Postgres data stays in the Docker volume. Migrations:

```bash
for f in database/migrations/*.sql; do
  [ -f "$f" ] && cat "$f" | docker compose exec -T postgres psql -U nivo -d nivo -v ON_ERROR_STOP=1
done
```

Or copy migrations and run selectively. Restart the tunnel if config changed:

```bash
launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist
launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist
```

---

## 5. Sync `.env` between machines

`.env` is not in git. To keep machines in sync:

1. **Manual copy** — copy `.env` and `frontend/.env` from one Mac to another (USB, secure chat, etc.).
2. **Secrets manager** — store in 1Password / Bitwarden / Vault and paste when needed.
3. **Doc** — keep a private checklist of required vars (see `.env.example`) so you can recreate `.env` on a new Mac.

Required vars for prod:

- `POSTGRES_PASSWORD`, `REQUIRE_AUTH`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
- `CORS_ORIGINS`, `CORS_ALLOW_VERCEL_PREVIEWS`
- `VITE_*` in `frontend/.env` (and Vercel env vars)

---

## 6. Quick reference

| Goal | Command |
|------|---------|
| Start dev (frontend) | `npm run dev` |
| Start API + Postgres | `docker compose up -d` |
| Rebuild API | `docker compose up -d --build` |
| Stop backend | `docker compose down` |
| Run migrations (Docker) | `cat db/migrations/XXX.sql \| docker compose exec -T postgres psql -U nivo -d nivo -v ON_ERROR_STOP=1` |
| Push to GitHub | `git push origin <branch>` |
| Deploy on Mac mini | `git pull && docker compose up -d --build` |

---

## 7. Flow summary

```
[Mac A or B]  develop → git commit → git push
                    ↓
              [GitHub]  main branch
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
   [Vercel]              [Mac mini]
   auto-deploy           manual: git pull
   frontend              docker compose up -d --build
                         API + Postgres
```

**Vercel** deploys automatically from GitHub (main or configured branch).  
**Mac mini** requires `git pull` and `docker compose up -d --build` when you want to update the API.
