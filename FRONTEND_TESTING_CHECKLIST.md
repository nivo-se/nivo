# Frontend Testing Checklist

**Date:** $(date)
**Status:** Ready for Testing

## Prerequisites

✅ Backend running on http://localhost:8000
✅ Redis running
✅ RQ Worker running (for enrichment)
✅ Frontend running on http://localhost:5173

---

## Pages to Test

### 1. Landing Page (`/`)
- [ ] Page loads without errors
- [ ] All sections render (Hero, Manifesto, Services, About, Community, Footer)
- [ ] Navigation links work
- [ ] Smooth scrolling works for anchor links
- [ ] No console errors

**Expected:** Static marketing page, no API calls

---

### 2. Auth Page (`/auth`)
- [ ] Page loads
- [ ] Login form displays
- [ ] Sign up form displays
- [ ] Form validation works
- [ ] Can switch between login/signup
- [ ] Error messages display correctly
- [ ] Success redirects work

**Expected:** Authentication UI, connects to Supabase

---

### 3. Style Guide (`/styleguide`)
- [ ] Page loads
- [ ] All UI components display
- [ ] No console errors

**Expected:** Static component showcase

---

### 4. AI Sourcing Dashboard (`/dashboard`) ⭐ **PRIMARY PAGE**
- [ ] Page loads (may require auth)
- [ ] **Left Panel - AI Chat Filter:**
  - [ ] Prompt input field works
  - [ ] Submit button triggers API call
  - [ ] Loading indicator shows during request
  - [ ] Results display: "X matches found"
  - [ ] Generated SQL WHERE clause displays
  - [ ] Copy SQL button works
  - [ ] Prompt history displays
  - [ ] Clicking history item re-runs search
  - [ ] No console errors

- [ ] **Right Panel - Company Explorer:**
  - [ ] Table displays companies
  - [ ] Columns: orgnr, name, revenue, EBITDA margin, growth, AI score
  - [ ] Checkboxes work for selection
  - [ ] Pagination controls work
  - [ ] "Enrich selection" button enabled when companies selected
  - [ ] "Export to CRM" button enabled when companies selected
  - [ ] "View AI Profile" button enabled when companies selected
  - [ ] "Save List" button works
  - [ ] Clicking company name navigates to detail page
  - [ ] No console errors

- [ ] **Session Persistence:**
  - [ ] Perform a search
  - [ ] Refresh the page
  - [ ] Verify: Results persist, prompt persists, history persists, pagination persists

- [ ] **API Connections:**
  - [ ] `POST /api/ai-filter/` - Called when submitting prompt
  - [ ] `POST /api/companies/batch` - Called to fetch company details
  - [ ] `POST /api/enrichment/start` - Called when clicking "Enrich selection"
  - [ ] `GET /api/enrichment/status/{job_id}` - Polled for job status
  - [ ] `POST /api/export/copper` - Called when clicking "Export to CRM"

**Expected:** Full AI sourcing workflow functional

---

### 5. Company Detail Page (`/companies/:orgnr`)
- [ ] Page loads
- [ ] **Company Info Section:**
  - [ ] Company name displays
  - [ ] Org number displays
  - [ ] Revenue displays (in mSEK format)
  - [ ] Employees display
  - [ ] Homepage link works (if available)

- [ ] **Financials Table:**
  - [ ] Historical data table displays
  - [ ] Columns: Year, Revenue (tSEK), EBIT (tSEK), EBIT Margin %, Net Profit (tSEK), Net Margin %
  - [ ] Values match Allabolag.se (spot check)
  - [ ] Years displayed: 2020-2024 (or available years)
  - [ ] No NULL values in critical columns

- [ ] **Growth Metrics:**
  - [ ] CAGR 3Y calculated and displayed
  - [ ] YoY growth calculated and displayed
  - [ ] Values are reasonable

- [ ] **AI Insights Section (if enriched):**
  - [ ] Product description displays
  - [ ] Industry sector/subsector displays
  - [ ] Market regions display as chips
  - [ ] Strategic fit score displays (1-10)
  - [ ] Defensibility score displays (1-10)
  - [ ] Risk flags display as list
  - [ ] Strategic playbook displays (formatted markdown)
  - [ ] Next steps display as numbered list
  - [ ] Scraped pages display as links

- [ ] **Navigation:**
  - [ ] "Back to Dashboard" button works
  - [ ] URL parameter (orgnr) correctly parsed

- [ ] **API Connections:**
  - [ ] `POST /api/companies/batch` - Fetches company data
  - [ ] `GET /api/companies/{orgnr}/financials` - Fetches financials
  - [ ] Supabase `ai_profiles` table - Fetches AI insights (if enriched)

**Expected:** Complete company information display

---

### 6. Valuation Page (`/valuation`)
- [ ] Page loads (may require auth)
- [ ] **Company Selection:**
  - [ ] Can search for companies
  - [ ] Can select from saved lists
  - [ ] Selected companies display in list
  - [ ] Minimum 3 companies validation works

- [ ] **Valuation Inputs:**
  - [ ] Revenue multiple input works
  - [ ] EBITDA multiple input works
  - [ ] Growth rate input works
  - [ ] Discount rate input works
  - [ ] All inputs have reasonable defaults

- [ ] **Valuation Results:**
  - [ ] Charts display (if applicable)
  - [ ] Summary metrics display
  - [ ] Export to CSV works
  - [ ] Export to Excel works

- [ ] **API Connections:**
  - [ ] `SavedListsService` - Loads saved lists
  - [ ] `supabaseDataService` - Fetches company data

**Expected:** Valuation calculator functional

---

### 7. Admin Page (`/admin`)
- [ ] Page loads (requires admin role)
- [ ] **Access Control:**
  - [ ] Non-admin users see "Access denied"
  - [ ] Admin users see AdminPanel

- [ ] **AdminPanel Features:**
  - [ ] User management displays
  - [ ] Can approve/reject users
  - [ ] Can change user roles
  - [ ] Statistics display

- [ ] **API Connections:**
  - [ ] Supabase auth - Checks user role
  - [ ] Admin endpoints - User management

**Expected:** Admin functionality accessible only to admins

---

### 8. 404 Not Found (`/*`)
- [ ] Invalid routes show NotFound page
- [ ] "Back to Home" button works
- [ ] No console errors

**Expected:** Graceful error handling

---

## API Integration Tests

### Backend API Endpoints (via Frontend)

1. **AI Filter API**
   - [ ] Frontend calls `POST /api/ai-filter/` correctly
   - [ ] Request body includes: `prompt`, `limit`, `offset`
   - [ ] Response parsed correctly: `org_numbers`, `total`, `parsed_where_clause`
   - [ ] Error handling works (network errors, API errors)

2. **Company Batch API**
   - [ ] Frontend calls `POST /api/companies/batch` correctly
   - [ ] Request body includes: `orgnrs` array
   - [ ] Response parsed correctly: `companies` array
   - [ ] Each company has: `orgnr`, `company_name`, `latest_revenue_sek`, margins, KPIs
   - [ ] Error handling works

3. **Company Financials API**
   - [ ] Frontend calls `GET /api/companies/{orgnr}/financials` correctly
   - [ ] Response parsed correctly: `financials` array
   - [ ] Each financial record has: `year`, `revenue_sek`, `ebit_sek`, `profit_sek`, margins
   - [ ] Error handling works

4. **Enrichment API**
   - [ ] Frontend calls `POST /api/enrichment/start` correctly
   - [ ] Request body includes: `org_numbers`, `force_refresh`
   - [ ] Response parsed correctly: `job_id`, `status`, `count`
   - [ ] Frontend polls `GET /api/enrichment/status/{job_id}` for updates
   - [ ] Loading states display correctly
   - [ ] Success/error feedback displays

5. **Export API**
   - [ ] Frontend calls `POST /api/export/copper` correctly
   - [ ] Request body includes: `org_numbers`, optional `copper_api_token`
   - [ ] Response parsed correctly: `success`, `exported`, `message`
   - [ ] Success feedback displays

### Supabase Integration

1. **AI Profiles**
   - [ ] Frontend fetches from Supabase `ai_profiles` table
   - [ ] Data displays correctly in Company Detail page
   - [ ] Missing profiles handled gracefully

2. **Saved Lists**
   - [ ] Frontend saves lists to Supabase `saved_company_lists` table
   - [ ] Frontend loads lists from Supabase
   - [ ] CRUD operations work

3. **Authentication**
   - [ ] Login works with Supabase
   - [ ] Sign up works with Supabase
   - [ ] Session persists
   - [ ] Protected routes redirect to `/auth` if not logged in

---

## Browser Console Checks

For each page, check browser console (F12):

- [ ] No JavaScript errors (red errors)
- [ ] No network errors (failed API calls)
- [ ] No React warnings
- [ ] API calls show in Network tab with correct:
  - [ ] Request method (GET/POST)
  - [ ] Request URL
  - [ ] Request body (for POST)
  - [ ] Response status (200, 404, 500, etc.)
  - [ ] Response body

---

## Cross-Browser Testing (Optional)

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)

---

## Performance Checks

- [ ] Page load time < 3 seconds
- [ ] API responses < 2 seconds
- [ ] No memory leaks (check after 10+ page navigations)
- [ ] Images load correctly
- [ ] No layout shifts

---

## Mobile Responsiveness (Optional)

- [ ] Dashboard works on mobile (375px width)
- [ ] Tables scroll horizontally if needed
- [ ] Forms are usable on mobile
- [ ] Navigation works on mobile

---

## Test Data

Use these test companies for consistent testing:

1. **Invicta Sweden AB** (5592881501)
   - Revenue: ~171M SEK
   - Good for testing financials display

2. **Agon AB** (5590521539)
   - Revenue: ~127M SEK
   - Good for testing AI filter results

3. **Ignease AB** (5591610430)
   - Revenue: ~70M SEK
   - Good for testing company detail

---

## Common Issues to Watch For

1. **CORS Errors**
   - Symptom: "CORS policy" errors in console
   - Fix: Check backend CORS configuration

2. **API Base URL Not Set**
   - Symptom: "Backend API is not configured" error
   - Fix: Set `VITE_API_BASE_URL` in `.env` or ensure dev mode uses localhost:8000

3. **Authentication Issues**
   - Symptom: Redirected to `/auth` on every page
   - Fix: Check Supabase configuration, ensure user is approved

4. **Missing Data**
   - Symptom: "N/A" or empty fields
   - Fix: Check API responses, verify database has data

5. **Session Storage Issues**
   - Symptom: Dashboard state not persisting
   - Fix: Check browser allows sessionStorage, check for storage quota errors

---

## Testing Script

Run automated tests:
```bash
./scripts/test_frontend.sh
```

Manual testing:
1. Start all servers (backend, Redis, RQ worker, frontend)
2. Open http://localhost:5173 in browser
3. Go through each page systematically
4. Check browser console for errors
5. Test all interactive elements
6. Verify API calls in Network tab

---

## Success Criteria

✅ All pages load without errors
✅ All API endpoints connect correctly
✅ All interactive elements work
✅ No console errors
✅ Data displays correctly
✅ Navigation works
✅ Session persistence works
✅ Error handling works gracefully

---

## Notes

- Frontend uses React Router for navigation
- API service automatically uses `http://localhost:8000` in dev mode
- Protected routes require authentication
- Some features require Supabase (auth, ai_profiles, saved_lists)
- Enrichment requires RQ worker to be running

