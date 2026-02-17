# Production Smoke Test Guide

**Purpose:** Validate that the Figma UX app works end-to-end against real Postgres/Supabase data.  
**Run after:** deploy, or before release.

---

## Prerequisites

- Backend running (`python -m uvicorn backend.api.main:app` or similar)
- `VITE_API_BASE_URL` or `VITE_API_BASE_URL` env points to backend
- Database migrations applied
- User authenticated (Supabase JWT or auth bypass in dev)

---

## Key Routes to Verify

| Route | What to check |
|-------|----------------|
| `/` | Dashboard loads, shows lists/prospects/runs counts |
| `/universe` | Universe grid loads, filters work, pagination |
| `/lists` | My Lists loads, cards visible |
| `/lists/:id` | List detail loads, company table renders |
| `/company/:orgnr` | Company detail loads, tabs (Overview, Financials, AI) |
| `/prospects` | Prospects page loads (may be empty if backend stubbed) |
| `/ai` | AI Lab loads, templates/recent runs visible |
| `/ai/run/create` | Create Run form loads |
| `/ai/runs/:id` | Run detail loads, progress/summary |
| `/ai/runs/:id/results` | Results tabs load |
| `/admin` | Admin loads, contracts, smoke test button works |

---

## 10-Minute MVP Gate Tests

### 1. Universe (2 min)
1. Go to `/universe`
2. Wait for grid to load
3. Apply a filter (e.g. Revenue > 5M)
4. Confirm results update
5. Paginate to page 2
6. Verify URL updates (shareable filters)

### 2. Save View as List (2 min)
1. On Universe, apply filters
2. Click "Save view as list" / "Create list from results"
3. Enter name, create
4. Navigate to `/lists`
5. Confirm new list appears
6. Click list → list detail loads

### 3. List Operations (2 min)
1. On list detail, add a company (Add to list) if UI supports
2. Remove a company from list (row remove)
3. Confirm counts update

### 4. Company Detail (2 min)
1. From Universe or List detail, click a company
2. Confirm Overview tab: metric cards, company info
3. Open Financials tab (if data exists)
4. Open AI tab (may show "Go to AI Lab" if no analysis)

### 5. AI Runs (2 min)
1. Go to `/ai`
2. Click "Create New Run"
3. Select template, list (or skip if empty)
4. Start run (or verify start works)
5. Navigate to run detail
6. If completed, open Results, verify Pending/Approved/Rejected tabs

---

## Admin Smoke Tests (In-App)

1. Go to `/admin`
2. Verify "Contracts" section shows API base URL, auth status
3. Click **Run smoke tests**
4. All 5 steps should pass:
   - 1) getCompanies
   - 2) getLists
   - 3) getListItems (if any lists)
   - 4) Universe query
   - 5) getAIRuns + run detail (if any runs)
5. Click **Run URL decode test**
6. Should show PASS

---

## Known Limitations (Backend Missing)

- **Prospects** – Returns empty; CRUD throws
- **AI Templates** – Returns empty; create/update/duplicate throw
- **updateList** – Throws (no PUT /lists/:id)
- **cancelAIRun** – Throws
- **approveResult / rejectResult** – Throw

These areas show "Coming soon" or gracefully handle errors. App should not crash.

---

## How to Run Locally

```bash
# Terminal 1: Backend
cd backend && uvicorn api.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Browser: http://localhost:5173
```

---

## After Deploy

1. Open production URL (e.g. `https://app.example.com`)
2. Sign in
3. Run through MVP gate tests above
4. In Admin, run smoke tests
5. Check for red errors in "Last API errors" section
