# Vercel + Mac Mini Setup Guide

**Note:** Railway has been removed. Backend and database run on the Mac Mini only.

## Backend (Mac Mini)

- **URL:** Your Mac Mini API URL (e.g. `https://api.yourdomain.com` or your chosen host/port).
- **Stack:** FastAPI, Postgres, Redis, RQ — all on the Mac Mini.

## Vercel Frontend Setup

### 1. Environment variable

1. **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** Your Mac Mini API URL (e.g. `https://api.yourdomain.com`)
   - **Environment:** Production, Preview, Development (as needed)
3. Save and redeploy.

### 2. Verify

1. Open your Vercel frontend URL.
2. DevTools → Console / Network.
3. Use a feature that calls the API (e.g. Financial Filters); confirm requests go to the Mac Mini backend.

## Testing the backend

```bash
# Replace with your Mac Mini API URL
curl https://api.yourdomain.com/health
# Expect: {"status":"healthy",...}
```

## Troubleshooting

- **Frontend can't reach backend:** Ensure `VITE_API_BASE_URL` in Vercel matches the Mac Mini API URL.
- **CORS errors:** On the Mac Mini, set `CORS_ORIGINS` or `CORS_ALLOW_VERCEL_PREVIEWS=true` so your Vercel domain is allowed.
- **Backend not responding:** Check the backend process and logs on the Mac Mini; ensure Postgres and Redis are running.

See [docs/CONNECTIONS_VERIFICATION.md](docs/CONNECTIONS_VERIFICATION.md) for full connection checks.
