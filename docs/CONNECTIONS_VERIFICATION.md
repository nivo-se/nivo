# Nivo connections verification

Use this to verify DB, auth, and deployment connections are intact.

## Architecture summary

| Component | Where it runs | Purpose |
|-----------|----------------|---------|
| **Frontend** | Vercel | React/Vite app; talks to Mac Mini backend API only |
| **Backend API** | Mac Mini | FastAPI (port 8000 or `PORT`); Postgres, Redis, RQ. All app hosting is here (Railway removed). |
| **Database** | Mac Mini (Postgres) | Companies, financials, KPIs. Postgres only; everything runs on the Mac Mini. |
| **Auth** | Auth0 | User authentication to the backend. Frontend uses Auth0; backend validates Auth0 tokens. |
| **/investor page** | Frontend (Vercel) | Simple password gate; no Auth0. Password unlocks access (sessionStorage). |

## 1. Database (Postgres on Mac Mini)

- **Production:** Database is Postgres on the Mac Mini (or same machine).
- **Backend:** Uses `DATABASE_SOURCE=postgres` and `POSTGRES_*` in `.env` (host, port, db, user, password).
- **Check:** In the app, open a page that loads companies/financials (e.g. Universe or Dashboard). If data loads, DB connection is working.
- **Backend health:** `curl http://localhost:8000/health` (local) or your Mac Mini API URL (e.g. `https://api.yourdomain.com/health`).

## 2. Auth (Auth0)

- **User auth:** Auth0 is used for all user authentication to the backend. Users sign in via Auth0; the frontend sends the Auth0 token to the backend; the backend validates Auth0 JWTs.
- **Env (typical):** Auth0 domain, client ID, audience; backend needs Auth0 JWT verification (e.g. JWKS or issuer/audience checks). JWT_SECRET used when verifying Bearer tokens.
- **Check:** Log in on the deployed frontend; if the session persists and API calls succeed with the Bearer token, Auth0 and backend verification are configured correctly.

## 3. /investor page (simple password)

- **Protection:** Access to `/investor` is protected by a **simple password** only (not Auth0). User enters the password on the investor gate; on success, access is stored in `sessionStorage` (`nivo_investor_unlocked`).
- **Implementation:** `frontend/src/pages/Investor.tsx` — gate component, password check, then long-form investor content.
- **Check:** Open `/investor` on the deployed site; you should see the password form. After entering the correct password, the investor material should be visible.

## 4. Vercel (frontend)

- **Build:** `vercel.json` uses `buildCommand: cd frontend && npm run build`, `outputDirectory: frontend/dist`.
- **API routes:** When `VITE_API_BASE_URL` is set, the frontend calls the **Mac Mini backend** for `/api/ai-analysis` (screening and deep). The Vercel serverless route `frontend/api/ai-analysis` is only used when no backend URL is configured (e.g. preview without backend). See [AI_ANALYSIS_WORKFLOW.md](AI_ANALYSIS_WORKFLOW.md).
- **Check:** Open the production/preview URL; if the app loads and can call the Mac Mini backend, frontend and routing are intact.

## 5. Mac Mini (backend + DB)

- **Expected:** Backend and Postgres run on the Mac Mini.
- **Frontend must point here:** Set `VITE_API_BASE_URL` (or equivalent) to the Mac Mini API URL (e.g. `https://api.yourdomain.com`) in Vercel env for production.
- **CORS:** Backend `api/main.py` allows configured origins; set `CORS_ORIGINS` or `CORS_ALLOW_VERCEL_PREVIEWS` so the Vercel domain is allowed.
- **Check:** From the live frontend, trigger an action that calls the backend (e.g. AI analysis, list save). If it succeeds, the Vercel → Mac Mini connection is intact.

## 6. Local “check all” quick commands

```bash
# Backend (must be running on 8000)
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/status

# Frontend (Vite may be on 8080 when using enhanced-server)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080
# or
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
```

## 7. Env checklist (production)

- **Vercel:** `VITE_API_BASE_URL` (Mac Mini API URL). Auth0 client/domain env vars if the frontend uses Auth0 SDK.
- **Mac Mini backend:** `DATABASE_SOURCE=postgres`, `POSTGRES_*`, Auth0 JWT verification config (e.g. JWKS URL or issuer/audience), `CORS_ORIGINS` / `CORS_ALLOW_VERCEL_PREVIEWS`, plus Redis/OpenAI/other keys as needed.

See `.env.example` and [PRODUCTION_ENV_CHECKLIST.md](PRODUCTION_ENV_CHECKLIST.md) for full lists.

---

## Legacy / codebase note

Backend uses JWT (JWT_SECRET or Auth0) for auth; DB is Postgres only. The `/investor` page remains password-only as implemented in `Investor.tsx`.
