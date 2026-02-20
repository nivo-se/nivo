# Go live: connect frontend to API (api.nivogroup.se)

Use this checklist so the Vite app (Vercel or local) talks to the tunneled API and Auth0 login → `/api/me` works end-to-end.

---

## Go live checklist (run in order)

| # | Step | Done |
|---|------|------|
| 1 | **Backend .env** (Mac mini / API host): `APP_ENV=prod`, `REQUIRE_AUTH=true`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` set; `CORS_ORIGINS` includes production frontend (e.g. `https://app.nivogroup.se`, `https://nivo-web.vercel.app`). |
| 2 | **Restart API:** `docker compose up -d api` (or `--build` if you changed code). |
| 3 | **Auth0 Dashboard:** Allowed Callback / Logout / Web Origins include `https://app.nivogroup.se`, your Vercel URL, and `http://localhost:5173`. |
| 4 | **Vercel:** Env vars `VITE_API_BASE_URL=https://api.nivogroup.se`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`. Redeploy if changed. |
| 5 | **Tunnel:** cloudflared running (`cloudflared tunnel --config config/cloudflared.yml run internal-api` or LaunchAgent per `RUN_SERVICES_PERSISTENTLY.md`). |
| 6 | **Smoke test:** Open production frontend → log in → DevTools Network: `GET https://api.nivogroup.se/api/me` returns 200 with `sub` and `role`. |

**Test in this branch first; merge to main when done.** To keep API and tunnel running after you close Cursor, see [TEST_THEN_MERGE_AND_KEEP_SERVICES_RUNNING.md](TEST_THEN_MERGE_AND_KEEP_SERVICES_RUNNING.md).

---

## 1. Backend (already done in this repo)

- **CORS:** `.env` has `CORS_ORIGINS=http://localhost:5173,http://localhost:8080,https://app.nivogroup.se`. Add any other frontend origins (e.g. your Vercel URL).
- **PUBLIC_PATHS:** Trimmed to minimal (`/ping`, `/health`, `/api/db/ping`, `/docs`, `/redoc`, `/openapi.json`). Everything else requires auth.
- **Restart API** after changing `.env`: `docker compose up -d --build api` (or restart your process).

---

## 2. Auth0 Dashboard (do manually)

In **Auth0 Dashboard** → your **Application** (SPA) → **Settings**:

1. **Allowed Callback URLs** — add (comma-separated):
   - `https://app.nivogroup.se/auth/callback`
   - Your Vercel URL if used: `https://your-app.vercel.app/auth/callback`
   - Local: `http://localhost:5173/auth/callback`

2. **Allowed Logout URLs** — add:
   - `https://app.nivogroup.se`
   - Vercel: `https://your-app.vercel.app`
   - `http://localhost:5173`

3. **Allowed Web Origins** — same as above (where the app is loaded from).

Save changes.

---

## 3. Frontend environment

**Local dev (e.g. `frontend/.env` or root `.env`):**

```bash
VITE_API_BASE_URL=https://api.nivogroup.se
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://api.nivogroup.se
```

To use the local API instead: `VITE_API_BASE_URL=http://127.0.0.1:8000`

**Vercel (Project → Settings → Environment Variables):** Add these four (replace placeholders with your Auth0 values):

| Name | Value |
|------|--------|
| `VITE_API_BASE_URL` | `https://api.nivogroup.se` |
| `VITE_AUTH0_DOMAIN` | Your Auth0 domain (e.g. `dev-xxxx.us.auth0.com`, no https://) |
| `VITE_AUTH0_CLIENT_ID` | Your SPA Application → Client ID from Auth0 Dashboard |
| `VITE_AUTH0_AUDIENCE` | `https://api.nivogroup.se` |

Use the same values as in your local `.env`. Redeploy after changing env vars.

---

## 4. Verify end-to-end

1. Open the app in the browser (Vercel URL or `http://localhost:5173` with `VITE_API_BASE_URL=https://api.nivogroup.se`).
2. Log in with Auth0.
3. After login, the app should call `GET https://api.nivogroup.se/api/me` and get 200 with `{ "sub": "...", "role": "..." }`.
4. In DevTools → Network, filter by “me” or “api” and confirm the request returns 200 and the response body has `sub` and `role`.

If you see **CORS** errors, add the exact request origin (e.g. `https://your-app.vercel.app`) to `CORS_ORIGINS` in the backend `.env` and restart the API.
