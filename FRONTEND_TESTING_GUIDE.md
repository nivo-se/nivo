# Frontend Testing Guide

## ✅ Services Running

### Backend Services
- **FastAPI Backend**: http://localhost:8000
  - Health: `GET /health`
  - API Docs: http://localhost:8000/docs
- **Redis**: Running on port 6379
  - Test: `redis-cli ping`

### Frontend Services
- **Vite Dev Server**: http://localhost:8080
- **Enhanced Server**: http://localhost:3001

---

## 🧪 Testing the AI Sourcing Dashboard

### 1. Access the Dashboard
Open your browser and navigate to:
```
http://localhost:8080/dashboard
```

Or if you need to authenticate first:
```
http://localhost:8080
```

**Note:** The route is `/dashboard` (not `/ai-sourcing-dashboard`)

### 2. Test AI Chat Filter Tab

**Steps:**
1. Navigate to the "AI Chat Filter" tab
2. Enter a natural language query, for example:
   - "Find profitable Swedish companies with revenue over 10 million SEK"
   - "Find logistics companies with high growth"
   - "Find companies with EBITDA margin over 15%"
3. Click "Run AI Filter"
4. Verify:
   - ✅ SQL query is generated and displayed
   - ✅ Matching companies are shown with org numbers
   - ✅ Result count is displayed
   - ✅ Query appears in "Recent prompts" history

**Expected Behavior:**
- Loading spinner appears while processing
- Results appear in a formatted grid
- SQL query is shown in a code block
- Error messages appear if API fails

### 3. Test Explorer View Tab

**Steps:**
1. After running an AI filter, switch to "Explorer View" tab
2. Verify:
   - ✅ Companies from the AI filter are displayed
   - ✅ Company details are shown (orgnr, name, revenue, etc.)
   - ✅ You can select companies with checkboxes

**Expected Behavior:**
- Table/grid view of companies
- Checkboxes for selection
- Company metadata displayed

### 4. Test AI Insights Tab

**Steps:**
1. Select one or more companies in Explorer View
2. Switch to "AI Insights" tab
3. Verify:
   - ✅ Selected companies are shown
   - ✅ AI-enriched profiles are displayed (if available)
   - ✅ Product description, end market, customer types shown

**Expected Behavior:**
- Shows enrichment data from `ai_profiles` table
- Displays strategic fit scores
- Shows value chain position

**Note:** If no enrichment data exists, you'll need to run enrichment first.

### 5. Test Export Queue Tab

**Steps:**
1. Select companies in Explorer View
2. Switch to "Export Queue" tab
3. Verify:
   - ✅ Selected companies are listed
   - ✅ Export button is available
   - ✅ Can export to Copper CRM format

**Expected Behavior:**
- List of selected companies
- Export button triggers API call
- Success/error message displayed

### 6. Test Enrichment Flow

**Steps:**
1. In Explorer View, select some companies
2. Look for "Enrich these companies" button or similar
3. Click to trigger enrichment
4. Verify:
   - ✅ Enrichment job is created
   - ✅ Job ID is returned
   - ✅ Status can be checked

**Expected Behavior:**
- Background job is queued in Redis
- Job status can be polled
- Results appear in AI Insights tab once complete

---

## 🔍 Debugging Tips

### Check Browser Console
Open DevTools (F12) and check:
- Network tab for API calls
- Console for errors
- Verify API calls are going to `http://localhost:8000`

### Check Backend Logs
```bash
tail -f /tmp/uvicorn.log
```

### Test API Directly
```bash
# Test AI Filter
curl -X POST http://localhost:8000/api/ai-filter/ \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find profitable companies", "limit": 5, "offset": 0}'

# Test Export
curl -X POST http://localhost:8000/api/export/copper \
  -H "Content-Type: application/json" \
  -d '{"org_numbers": ["5569771651"]}'

# Test Enrichment
curl -X POST http://localhost:8000/api/enrichment/start \
  -H "Content-Type: application/json" \
  -d '{"org_numbers": ["5569771651"]}'
```

### Common Issues

1. **CORS Errors**
   - Verify backend CORS is configured for `http://localhost:8080`
   - Check `backend/api/main.py` CORS settings

2. **API Not Found (404)**
   - Verify endpoint path includes trailing slash: `/api/ai-filter/`
   - Check `frontend/src/lib/apiService.ts` endpoint paths

3. **Connection Refused**
   - Verify backend is running: `curl http://localhost:8000/health`
   - Check `VITE_API_BASE_URL` is not overriding localhost

4. **Empty Results**
   - Check database has data: `sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM companies"`
   - Verify SQL query in browser console

---

## 📊 Expected Test Results

### ✅ Successful Flow
1. User enters prompt → AI Filter returns companies
2. Companies appear in Explorer View
3. User selects companies
4. User views AI Insights (may be empty if not enriched)
5. User exports to Copper CRM

### ⚠️ Known Limitations
- Enrichment requires Redis (now running)
- AI Insights will be empty until enrichment jobs complete
- Export to Copper is a placeholder (returns success but doesn't actually export)

---

## 🚀 Next Steps After Testing

1. **Run Enrichment Jobs**
   - Select companies in Explorer
   - Trigger enrichment
   - Wait for jobs to complete
   - View results in AI Insights

2. **Test with Real Data**
   - Try different prompts
   - Test edge cases (empty results, errors)
   - Verify SQL generation quality

3. **Integrate Copper CRM**
   - Add actual Copper API integration
   - Test real exports

4. **Polish UI**
   - Improve error messages
   - Add loading states
   - Enhance company display

---

**Happy Testing! 🎉**

