# Cloudflare Tunnel — verification checklist

Use this to confirm everything is set up. All commands are meant to be run from **Cursor’s terminal** (project root).

---

## What we verified on your machine

| Check | Status |
|-------|--------|
| Homebrew installed | OK — `brew` at `/usr/local/bin/brew` |
| cloudflared installed | OK — `cloudflared` at `/usr/local/bin/cloudflared` (2026.2.0) |
| Cloudflare login | OK — `~/.cloudflared/cert.pem` present |
| Tunnel created | OK — tunnel **internal-api** (ID `499a5433-08f5-419d-bb28-d0671d155d14`) |
| Tunnel credentials | OK — `~/.cloudflared/499a5433-08f5-419d-bb28-d0671d155d14.json` |
| Config file | OK — `config/cloudflared.yml` created with your tunnel ID and hostname `api.nivogroup.se` |
| Docker (Postgres + API) | OK — containers running, `http://localhost:8000/health` returns 200 |
| Tunnel test run | OK — `cloudflared tunnel --config config/cloudflared.yml run internal-api` connects successfully |

---

## What you still need to do

### 1. Route DNS to the tunnel (if not already done in Dashboard)

So that `api.nivogroup.se` (or your chosen hostname) points to your tunnel:

```bash
cloudflared tunnel route dns internal-api api.nivogroup.se
```

If your domain is different (e.g. `api.yourdomain.com`), use that hostname and update `config/cloudflared.yml` so the first ingress `hostname` matches.

If you already added the public hostname in the Cloudflare Dashboard (Zero Trust → Networks → Tunnels → internal-api → Public Hostname), you can skip this step.

### 2. Run the tunnel (choose one)

**Option A — Run in Cursor terminal (stops when you close Cursor):**

```bash
cloudflared tunnel --config config/cloudflared.yml run internal-api
```

**Option B — Run as a service (keeps running after closing Cursor):**

Follow [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md) §2. The plist there already uses tunnel name **internal-api** and the correct `--config` order.

### 3. Test from the internet

With the tunnel running and DNS set:

```bash
curl -s https://api.nivogroup.se/health
```

You should get the API health JSON. If you get a Cloudflare error or timeout, check:

- Tunnel is running (Option A or B above).
- In Cloudflare Dashboard, tunnel **internal-api** has a Public Hostname for `api.nivogroup.se` (or your hostname) → `http://localhost:8000`.
- Your domain’s DNS is on Cloudflare (nameservers pointed to Cloudflare).

### 4. Backend and frontend

- **Backend `.env`:** Set `CORS_ORIGINS` to your frontend origin (e.g. `https://app.nivogroup.se` or `http://localhost:5173` for local dev).
- **Auth0:** In the Auth0 SPA settings, add your frontend URL to Allowed Callback URLs, Logout URLs, and Web Origins.
- **Frontend:** Set `VITE_API_BASE_URL=https://api.nivogroup.se` (or your API hostname) when building or running the app that talks to the tunnel.

---

## Correct cloudflared command order

Use this order (config right after `tunnel`, then `run`, then tunnel name):

```bash
cloudflared tunnel --config config/cloudflared.yml run internal-api
```

Not: `cloudflared tunnel run --config ...` (that can fail with “flag not defined”).

---

## If your domain is not nivogroup.se

Edit `config/cloudflared.yml` and change the first ingress `hostname` to your API hostname (e.g. `api.yourdomain.com`). Then run the DNS route command with that hostname.

---

## Quick hardening (once tunnel is live)

1. **Test authenticated endpoint (fail closed)**  
   Without a token you should get **401**:
   ```bash
   curl -i https://api.nivogroup.se/api/me
   ```
   You should see `401` and a body like `{"detail":"Authentication required"}`. That confirms protected routes are not public.

2. **Cloudflare SSL/TLS**  
   In Cloudflare Dashboard → **SSL/TLS** → set encryption mode to **Full** (or **Full (strict)** if you add an origin certificate later). Tunnel to localhost is usually fine with **Full**.

3. **Trim PUBLIC_PATHS for production**  
   Done: `backend/api/auth.py` now has a minimal set (`/ping`, `/health`, `/api/db/ping`, `/docs`, `/redoc`, `/openapi.json`). All other routes require auth.

---

## Connect frontend (Vercel/Vite) to the API

**Full checklist:** [GO_LIVE_FRONTEND_API.md](GO_LIVE_FRONTEND_API.md)

- Backend: `CORS_ORIGINS` in `.env` includes your frontend origin(s); restart API after change.
- Auth0: add callback/logout/web origins for your app URL(s).
- Frontend: `VITE_API_BASE_URL=https://api.nivogroup.se` (and Auth0 vars); rebuild/redeploy.
- Verify: log in → DevTools → Network → `/api/me` returns 200 with `sub` and `role`.
