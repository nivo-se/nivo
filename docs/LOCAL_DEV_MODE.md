# Local Development Mode

Work locally without Supabase until ready to launch. Supabase Auth is bypassed; mock user is used.

## Current Setup

| Component | Mode | Details |
|-----------|------|---------|
| **Database** | Local SQLite | `data/nivo_optimized.db` via `DATABASE_SOURCE=local` |
| **Auth** | Bypassed | `VITE_AUTH_DISABLED=true` → mock user (no Supabase calls) |
| **Backend** | FastAPI on 8000 | `./scripts/start_backend.sh` |
| **Frontend** | Vite on 8080 | `cd frontend && npm run dev` |

## Start Everything

```bash
# Terminal 1: Backend
./scripts/start_backend.sh

# Terminal 2: Frontend (Vite + enhanced-server)
cd frontend && npm run dev
```

Then open **http://localhost:8080**

## When Ready for Production

1. Unpause or recreate Supabase project
2. Set `VITE_AUTH_DISABLED=false` (or remove it) in frontend env
3. Set `DATABASE_SOURCE=postgres` with Supabase Postgres credentials
4. See [PRODUCTION_ENV_CHECKLIST.md](PRODUCTION_ENV_CHECKLIST.md)
