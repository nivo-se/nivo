# MVP Deploy Checklist (/new)

Short, actionable checklist for deploying the /new MVP.

## Commands to run locally

**Backend:**
```bash
cd backend && uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend && npm run dev
```
Or for production build:
```bash
cd frontend && npm run build && npm run preview
```
Set `VITE_API_BASE_URL=http://localhost:8000` (or your backend URL).

## Frontend env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `VITE_API_BASE_URL` | Yes | Backend API URL (e.g. `https://api.example.com`) |
| `VITE_AUTH_DISABLED` | No | Set to `true` to skip auth (dev only) |

## Backend CORS

- Allow `Authorization` header
- Allow credentials if using cookies
- Origins must include frontend URL (and localhost for dev)

## Backend auth

- `REQUIRE_AUTH`: typically `true` in production
- `SUPABASE_JWT_SECRET`: required if using Supabase auth (JWT validation)

## 10‑minute manual smoke test

1. **Frontend**
   ```bash
   cd frontend && npm run build && npm run preview
   ```
   Open `http://localhost:4173/new` (or configured port).

2. **Universe** (`/new/universe`)
   - Page loads, table visible
   - Search: type, wait for debounce, results update
   - Sort: click column headers, order changes
   - Pagination: Next/Prev work
   - Null numerics show "—"

3. **Save view as list** (Universe)
   - Set filters/search, click "Save view as list"
   - Enter name, create
   - Redirects to list, toast shows `insertedCount`

4. **Add/remove list items**
   - Universe: "Add to list" on row → pick list → success toast
   - ListDetail: trash icon → confirm → item removed
   - Refresh: changes persist

5. **URL persistence** (`/new/universe`)
   - Set search + filters, note `?u=...` in URL
   - Reload: state restored
   - New tab with same URL: same state
   - Malformed `?u=invalid` does not crash

6. **Admin** (`/new/admin`)
   - "Last 5 API errors" section visible when errors exist
   - "Run smoke tests" → all steps PASS (if backend is up)
   - "Run URL decode test" → PASS
