# Supabase Auth for Production

Nivo uses Supabase Auth for JWT-gated backend in production while keeping local dev on Docker Postgres with optional auth.

## Environment Variables

### Backend (.env or hosting env)

| Variable | Description |
|----------|-------------|
| `APP_ENV` | `local` or `prod` |
| `REQUIRE_AUTH` | When `true`, all `/api` routes require valid JWT (except allowlisted) |
| `DATABASE_SOURCE` | `supabase` in prod for hosted Postgres |
| `SUPABASE_URL` | Project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only; never expose to frontend |
| `SUPABASE_JWT_SECRET` | From Project Settings > API > JWT Secret; used to verify user tokens |

### Frontend (Vercel env vars)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Same as backend SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key (safe for frontend) |
| `VITE_API_BASE_URL` | Backend API URL (e.g. Railway) |

## Production Setup

1. **Supabase project**: Create project, enable Auth (Email, Google, etc.).
2. **Backend env**:
   - `APP_ENV=prod`
   - `REQUIRE_AUTH=true`
   - `DATABASE_SOURCE=supabase`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
3. **Frontend env**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

## Local Dev

- `APP_ENV=local`, `REQUIRE_AUTH=false` → auth optional
- `DATABASE_SOURCE=postgres` → Docker Postgres
- Frontend can use magic link or Google to get a session; token is sent when configured

## Security

- **Never** put `SUPABASE_SERVICE_ROLE_KEY` in frontend. It bypasses RLS.
- Use `VITE_SUPABASE_ANON_KEY` for client-side Supabase Auth only.
- Backend uses `SUPABASE_SERVICE_ROLE_KEY` server-side for DB access (no RLS required initially).
- Backend verifies user JWTs with `SUPABASE_JWT_SECRET` (HS256).
