# Auth0 Setup (minimal footprint)

This project is **Vite + React** (not Next.js). We use the official **Auth0 React SDK** (`@auth0/auth0-react`). Auth0 runs in the cloud, so **no extra containers** run on your Mac mini.

---

## 1. Create an Auth0 account and application

1. Sign up at [auth0.com](https://auth0.com).
2. In the Dashboard, go to **Applications → Applications** and **Create Application**.
3. Choose **Single Page Application** (required for the React SDK; do **not** use Regular Web Application). If you already created a Regular Web Application, create a new application with type **Single Page Application** or change the type in Application Settings.
4. Note:
   - **Domain** → e.g. `your-tenant.us.auth0.com` (use for `AUTH0_DOMAIN` and `VITE_AUTH0_DOMAIN`).
   - **Client ID** → use for `VITE_AUTH0_CLIENT_ID`.

---

## 2. Create an API in Auth0 (for backend JWT validation)

1. Go to **Applications → APIs** and **Create API**.
2. Name it (e.g. "Nivo API"), set **Identifier** to your API audience URL (e.g. `https://api.nivogroup.se`). This is your **Audience**.
3. Enable **Allow Offline Access** (for refresh tokens; avoids `/oauth/token` 401 when tokens expire).
4. Note the **Identifier** → use for `AUTH0_AUDIENCE` and `VITE_AUTH0_AUDIENCE`.

**Example (Nivo production):** Audience `https://api.nivogroup.se`, Issuer `https://dev-fkrjopczcor0bjzt.us.auth0.com/`. The FastAPI backend and any Express gateway should use the same values so the same token works for both.

---

## 3. Configure the SPA in Auth0 Dashboard

1. Open your **Application** (the SPA) → **Settings**.
2. Add **both dev and prod** URLs so you don’t get silent failures or “login works but API calls don’t”:

   **Allowed Callback URLs**
   - `http://localhost:5173/auth/callback`
   - `https://<your-frontend-domain>/auth/callback`

   **Allowed Web Origins**
   - `http://localhost:5173`
   - `https://<your-frontend-domain>`

   **Allowed Logout URLs**
   - `http://localhost:5173`
   - `https://<your-frontend-domain>`

3. **API (Applications → APIs):** Identifier (audience) = `https://api.nivogroup.se`, **Signing Algorithm** = RS256.
4. Save.

---

## 4. Backend env (`.env`)

```bash
# Require JWT for /api when ready
REQUIRE_AUTH=true

# Auth0 — same audience/issuer as any Express gateway (e.g. express-oauth2-jwt-bearer)
AUTH0_DOMAIN=dev-fkrjopczcor0bjzt.us.auth0.com
AUTH0_AUDIENCE=https://api.nivogroup.se
```

Use your real **Domain** and API **Identifier** (audience). For an Express gateway using `express-oauth2-jwt-bearer`, set `audience` and `issuerBaseURL` to the same values (see `docs/auth0-express-gateway-example.js`).

---

## 5. Frontend env (local and Vercel)

**Local:** `frontend/.env` or root `.env`. **Vercel:** Project → Settings → Environment Variables. Set all four:

```bash
VITE_API_BASE_URL=https://api.nivogroup.se
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.nivogroup.se
```

For local dev only you can use `VITE_API_BASE_URL=http://localhost:8000`. See [GO_LIVE_FRONTEND_API.md](GO_LIVE_FRONTEND_API.md) for the full Vercel checklist.

---

## 6. Frontend: send the access token (not the ID token)

The frontend must send the **access token** for your API audience. We use `getAccessTokenSilently()` (in `Auth0AuthProvider` / `authToken.ts`), which returns the access token. Do **not** send the ID token to the API — that is the #1 cause of “login works but API returns 401”.

- **Audience:** `VITE_AUTH0_AUDIENCE=https://api.nivogroup.se` (passed into `Auth0Provider` `authorizationParams.audience`).
- **Scope:** `openid profile email` is set in `Auth0Provider` so you get email for allowlists/roles later.

Then the access token will have `aud` = that identifier. **Quick validation:** decode the access token (e.g. [jwt.io](https://jwt.io)) and check:

- `iss` = `https://dev-fkrjopczcor0bjzt.us.auth0.com/`
- `aud` contains `https://api.nivogroup.se`
- Header `alg` = RS256

## 7. FastAPI: same issuer + audience

Backend uses:

- **Issuer:** `https://<AUTH0_DOMAIN>/` (trailing slash; see `backend/api/auth.py`).
- **Audience:** `AUTH0_AUDIENCE`. Auth0 may send `aud` as a string or array; PyJWT handles both.

If Express accepts a token but FastAPI rejects it, the usual causes are issuer formatting (trailing slash) or audience handling.

## 7b. Identity: sub vs email in the access token

We request `scope: "openid profile email"`, but the **access token** may not include `email` unless you add it via an Auth0 Action. Two patterns:

- **Pattern A (recommended):** Use `sub` as the stable user id. Store roles and allowlists by `sub` in your backend/Postgres. No dependency on `email` in the token.
- **Pattern B:** If you need `email` (or custom roles) in the access token, add an Auth0 Action that sets **namespaced** custom claims (e.g. `https://nivogroup.se/email`, `https://nivogroup.se/roles`). Do not use reserved claim names; use a URL namespace.

For allowlisting, Pattern A is simplest: allowlist by `sub`.

## 8. Express example as smoke test

Use `docs/auth0-express-gateway-example.js` as a “known good” verifier before debugging FastAPI:

1. Log in via the Vite app.
2. Grab the access token (e.g. from DevTools → Application → storage, or a temporary `console.log(getAccessTokenSilently())`).
3. `curl -H "Authorization: Bearer <token>" http://localhost:8080/authorized`
4. If Express returns 200, the token’s `aud`/`iss` are correct. If FastAPI then rejects the same token, the issue is in FastAPI (e.g. issuer/audience or JWKS cache).

## 9. Do you need an Express gateway?

Probably **not** right now. Add one only if you need:

- A single entrypoint routing to multiple backends
- Extra middleware (rate limiting, WAF-like logic, request shaping)
- WebSockets or edge-style behavior

Otherwise: keep it simple → e.g. Cloudflare Tunnel → FastAPI.

## 10. Production hardening

- **Fail closed:** If `REQUIRE_AUTH=true` and `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` is missing, the backend **raises on startup** and does not start. Set both in `.env` before running in production.
- **Public paths:** Keep them minimal. Recommended: `/ping`, `/health` (and `/metrics` if you add it). Everything else behind auth. The codebase may include extra public API paths for dev; for strict production, trim `PUBLIC_PATHS` in `backend/api/auth.py`.
- **JWKS:** Backend fetches JWKS with a short timeout (3s), caches in memory, and refreshes on key-id mismatch so Auth0 key rotation works without restart.
- **CORS:** For “works in curl but not in browser”, ensure:
  - Your dev and prod frontend origins are in `CORS_ORIGINS` (comma-separated) or in the default list (localhost ports). When moving to office or production, add your actual frontend origin(s).
  - `Authorization` is allowed (backend uses `allow_headers: ["*"]`).
  - You don’t need `allow_credentials` for Bearer tokens; it’s set for compatibility.

- **Tunnel / reverse proxy:** If the API is behind Cloudflare Tunnel (or similar), ensure the tunnel forwards `/api/*` to the FastAPI backend so route prefixes stay consistent (`/api/me`, `/api/admin/*`, etc.).

---

## Summary

| Where        | Variable              | Value                          |
|-------------|------------------------|--------------------------------|
| Backend     | `AUTH0_DOMAIN`        | `dev-fkrjopczcor0bjzt.us.auth0.com`     |
| Backend     | `AUTH0_AUDIENCE`      | `https://api.nivogroup.se`               |
| Backend     | `REQUIRE_AUTH`        | `true` to enforce JWT          |
| Backend     | `REQUIRE_ALLOWLIST`   | `false` (or `true` to enforce allowlist) |
| Frontend    | `VITE_AUTH0_DOMAIN`   | Same as domain                 |
| Frontend    | `VITE_AUTH0_CLIENT_ID`| SPA Application Client ID      |
| Frontend    | `VITE_AUTH0_AUDIENCE` | Same as backend audience       |

**Stack on the machine:** Postgres + API only. Auth0 runs in the cloud.

---

## 11. Roles (local Postgres, keyed by `sub`)

RBAC is stored in **local Postgres only** (no Supabase, no Auth0 Management API). Users are identified by Auth0 **sub** (e.g. `auth0|xxxxxxxx`).

- **Tables:** `user_roles` (sub, role), `allowed_users` (sub, enabled, note). Created by migration `020_user_roles_allowed_users.sql`. No seed; first admin is inserted manually after first login (see docs/BOOTSTRAP_ROLES.md).
- **Roles:** `admin` and `analyst`. Admin can do everything; analyst is the default role. Enforced in backend via `require_role("admin")` on admin endpoints.
- **Allowlist (optional):** Set `REQUIRE_ALLOWLIST=true` in `.env`. Then only subs listed in `allowed_users` with `enabled = true` can access protected routes (in addition to valid JWT). Default is `REQUIRE_ALLOWLIST=false`.

**Finding a user’s sub**

- After login, call **GET /api/me** (with Bearer token). The response includes `sub` and `role`.
- Or inspect the JWT (e.g. [jwt.io](https://jwt.io)) and read the `sub` claim.
- Or check Auth0 Dashboard → User Management → Users → select user → copy **User ID** (that is the sub).

**Bootstrap: first admin**

1. Log in as yourself in the app (Auth0).
2. Call **GET /api/me** (e.g. from DevTools or `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/me`) and copy the `sub` value.
3. Insert your sub as admin in Postgres:
   ```sql
   INSERT INTO user_roles (sub, role) VALUES ('auth0|YOUR_SUB_HERE', 'admin')
   ON CONFLICT (sub) DO UPDATE SET role = 'admin';
   ```
4. Optional: if using allowlist, insert into `allowed_users`:
   ```sql
   INSERT INTO allowed_users (sub, enabled, note) VALUES ('auth0|YOUR_SUB_HERE', true, 'First admin')
   ON CONFLICT (sub) DO UPDATE SET enabled = true;
   ```
5. Reload the app; the Admin panel and GET /api/admin/users will work for your user.

**Migrations**

- Apply schema: `./scripts/run_postgres_migrations.sh` (includes 020; 021 is optional and not run by default).

---

## Troubleshooting: Signup redirects back to login

If users sign up successfully but are redirected back to the login screen:

1. **Auth0 "Require Email Verification"**  
   Auth0 Dashboard → Authentication → Database → your connection → if "Require Email Verification" is on, Auth0 may redirect users to the login page before verification. For development, you can turn this off. For production, users must verify their email before Auth0 completes the sign-in.

2. **API not authorized for the application**  
   If you see "Client ... is not authorized to access resource server ...", go to APIs → your API → enable the application (or add it under Machine to Machine Applications).

3. **401 on Auth0 `/oauth/token`**  
   The SDK uses this to exchange the auth code or refresh tokens. Ensure:
   - **Allowed Web Origins** includes your exact frontend URL (e.g. the Vercel preview domain).
   - **APIs → your API → Allow Offline Access** is enabled (needed for refresh tokens).
   - **Applications → your app** is enabled for the API.
