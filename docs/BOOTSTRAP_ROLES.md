# Bootstrap first admin (roles in local Postgres)

**No seed migration.** First admin is created either from the app (“Claim first admin”) or by manual insert. See [AUTH_AUTH0_SETUP.md](AUTH_AUTH0_SETUP.md) §11 for full detail.

## Option A — From the app (recommended)

1. **Run migrations** on the target DB (e.g. Mac mini):
   ```bash
   ./scripts/run_postgres_migrations.sh
   ```
2. **Log in** once with Auth0. You’ll see a “No role assigned” screen.
3. Click **Claim first admin**. The app calls `POST /api/bootstrap`, which adds your Auth0 `sub` to `user_roles` as `admin` (and to `allowed_users` if `REQUIRE_ALLOWLIST=true`).
4. The page reloads; you’re in as admin.

## Option B — Manual insert (psql)

1. **Run migrations** (see above).
2. **Log in** once in the app (Auth0).
3. **Get your sub:** call `GET /api/me` with your Bearer token (DevTools → Network, or `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/me`) and copy the `sub` value.
4. **Insert admin in Postgres:**
   ```bash
   psql "$DATABASE_URL" -c "INSERT INTO user_roles (sub, role) VALUES ('auth0|YOUR_SUB', 'admin') ON CONFLICT (sub) DO UPDATE SET role = 'admin';"
   ```
5. **If using allowlist** (`REQUIRE_ALLOWLIST=true`):
   ```bash
   psql "$DATABASE_URL" -c "INSERT INTO allowed_users (sub, enabled) VALUES ('auth0|YOUR_SUB', true) ON CONFLICT (sub) DO UPDATE SET enabled = true;"
   ```
6. **Reload the app** — Admin panel and `GET /api/admin/users` will work for your user.

**Prerequisites:** Migration 020 applied (user_roles + allowed_users). `REQUIRE_AUTH=true`, `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` set.

---

## API route prefixes (consistent)

All app API routes live under `/api/*` so CORS and proxy/tunnel config stay simple:

- `GET /api/me` — current user (sub, role)
- `GET /api/admin/users` — list user_roles + allowed_users (admin only)
- `PUT /api/admin/users/{sub}/role` — set role (admin only)
- `PUT /api/admin/users/{sub}/allow` — set allowlist (admin only)

When moving from localhost to office or Cloudflare Tunnel:

- Set **CORS_ORIGINS** to your actual frontend origin(s) (e.g. `https://app.nivogroup.se`).
- If the API is behind Cloudflare Tunnel (or another reverse proxy), ensure the tunnel forwards `/api/*` to the FastAPI backend so paths stay consistent.
