# Dashboard API Endpoint Audit

## ✅ Backend Endpoints (Railway/FastAPI)

### Available Endpoints

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/health` | GET | ✅ | Health check |
| `/api/status` | GET | ✅ | API status (Supabase, Redis) |
| `/api/filters/analytics` | GET | ✅ | Get filter analytics |
| `/api/filters/apply` | POST | ✅ | Apply filters and generate shortlist |
| `/api/companies/{orgnr}/intel` | GET | ✅ | Get company intelligence |
| `/api/companies/{orgnr}/ai-report` | GET | ✅ | Get AI report for company |
| `/api/companies/{orgnr}/enrich` | POST | ✅ | Trigger enrichment for company |
| `/api/jobs/enrich` | POST | ✅ | Trigger batch enrichment |
| `/api/jobs/{job_id}` | GET | ✅ | Get job status |
| `/api/jobs/` | GET | ✅ | List all jobs |
| `/api/ai-reports/generate` | POST | ✅ | Generate AI report |
| `/api/ai-reports/generate-batch` | POST | ✅ | Generate AI reports in batch |
| `/api/shortlists/stage1` | GET | ✅ | Get all Stage 1 shortlists |
| `/api/shortlists/stage1/{shortlist_id}` | GET | ✅ | Get specific Stage 1 shortlist |

## ❌ Missing Backend Endpoints

These endpoints are called from the frontend but **DO NOT EXIST** in the Railway backend:

| Endpoint | Method | Used By | Status |
|----------|--------|---------|--------|
| `/api/ai-analysis` | POST | `AIAnalysis.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/ai-analysis?history=1&limit=10` | GET | `AIAnalysis.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/ai-analysis?runId=...` | GET | `AIAnalysis.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/saved-lists` | GET/POST | `savedListsService.ts` | ❌ **MISSING** - Should use Supabase directly |
| `/api/saved-lists/{id}` | PUT/DELETE | `savedListsService.ts` | ❌ **MISSING** - Should use Supabase directly |
| `/api/valuation` | POST | `Valuation.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/valuation/{runId}/{orgnr}` | GET | `ValuationModelsCard.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/valuation/{runId}/select` | POST | `ValuationModelsCard.tsx` | ❌ **MISSING** - Vercel serverless function |
| `/api/companies?search=...` | GET | `Valuation.tsx` | ❌ **MISSING** - Should use Supabase directly |
| `/api/analysis-runs` | GET | `analysisRunsService.ts` | ❌ **MISSING** - Vercel serverless function |
| `/api/analysis-runs/{runId}` | GET | `analysisRunsService.ts` | ❌ **MISSING** - Vercel serverless function |
| `/api/analysis-runs/{runId}` | DELETE | `analysisRunsService.ts` | ❌ **MISSING** - Vercel serverless function |
| `/api/analysis-runs/{runId}/rerun` | POST | `analysisRunsService.ts` | ❌ **MISSING** - Vercel serverless function |
| `/api/search/vector` | GET | `intelligenceService.ts` | ❌ **MISSING** - Not implemented yet |

## ⚠️ Hardcoded Localhost URLs

These components use hardcoded `localhost` URLs that **WON'T WORK** in production:

| File | URL | Issue | Fix |
|------|-----|-------|-----|
| `SessionTrackingDashboard.tsx` | `http://localhost:3000/api/sessions` | ❌ Hardcoded | Should use Railway or Vercel serverless |
| `SessionTrackingDashboard.tsx` | `http://localhost:3000/api/monitoring/...` | ❌ Hardcoded | Should use Railway or Vercel serverless |
| `ScraperStatusDashboard.tsx` | `http://localhost:8000/staging/jobs` | ❌ Hardcoded | Should use Railway API |
| `ScraperStatusDashboard.tsx` | `http://localhost:8000/staging/companies` | ❌ Hardcoded | Should use Railway API |
| `localDataService.ts` | `http://localhost:8000` | ⚠️ Dev only | OK for local dev, but should use Railway in prod |

## 🔧 Relative URLs (May Not Work)

These use relative URLs (`/api/...`) which work with Vercel serverless functions but **NOT** with Railway:

| File | Endpoint | Issue | Fix |
|------|----------|-------|-----|
| `AIAnalysis.tsx` | `/api/ai-analysis` | ⚠️ Vercel serverless | OK if deployed on Vercel |
| `savedListsService.ts` | `/api/saved-lists` | ⚠️ Vercel serverless | Should use Supabase directly |
| `Valuation.tsx` | `/api/valuation` | ⚠️ Vercel serverless | OK if deployed on Vercel |
| `analysisRunsService.ts` | `/api/analysis-runs` | ⚠️ Vercel serverless | OK if deployed on Vercel |

## ✅ Correctly Configured Services

These services correctly use `intelligenceService` or Supabase:

| Service | Endpoint | Status |
|---------|----------|--------|
| `intelligenceService.ts` | All endpoints | ✅ Uses `VITE_API_BASE_URL` or localhost in dev |
| `FinancialFilterPanel.tsx` | `/api/filters/*` | ✅ Uses `intelligenceService` |
| `supabaseDataService.ts` | Direct Supabase calls | ✅ Correct |
| `supabaseCompanyService.ts` | Direct Supabase calls | ✅ Correct |

## 📋 Action Items

### High Priority

1. **Fix hardcoded localhost URLs**
   - [ ] `SessionTrackingDashboard.tsx` - Update to use Railway or remove if not needed
   - [ ] `ScraperStatusDashboard.tsx` - Update to use Railway API or remove if not needed

2. **Fix saved lists service**
   - [ ] `savedListsService.ts` - Already uses Supabase as fallback, but API calls will fail
   - [ ] Consider removing API calls and using Supabase directly

3. **Fix AI Analysis endpoints**
   - [ ] `AIAnalysis.tsx` - Uses Vercel serverless functions (`/api/ai-analysis`)
   - [ ] These work on Vercel but won't work if calling Railway
   - [ ] Consider migrating to Railway backend or keep as Vercel serverless

### Medium Priority

4. **Fix Valuation endpoints**
   - [ ] `Valuation.tsx` - Uses Vercel serverless functions
   - [ ] Consider migrating to Railway or keep as Vercel serverless

5. **Fix Analysis Runs service**
   - [ ] `analysisRunsService.ts` - Uses Vercel serverless functions
   - [ ] Consider migrating to Railway or keep as Vercel serverless

6. **Add missing search endpoint**
   - [ ] Implement `/api/search/vector` in Railway backend
   - [ ] Currently called by `intelligenceService.vectorSearch()`

### Low Priority

7. **Documentation**
   - [ ] Document which endpoints are Vercel serverless vs Railway
   - [ ] Create API endpoint reference guide

## 🔍 Testing Checklist

After fixes, test:

- [ ] Financial Filters - Should work (uses `intelligenceService`)
- [ ] AI Analysis - Check if Vercel serverless functions are accessible
- [ ] Saved Lists - Check if Supabase fallback works
- [ ] Valuation - Check if Vercel serverless functions work
- [ ] Company Search - Check if Supabase queries work
- [ ] Dashboard Analytics - Check if Supabase queries work

## 📝 Notes

- **Vercel Serverless Functions**: Endpoints like `/api/ai-analysis` are Vercel serverless functions, not Railway endpoints. These work when frontend is deployed on Vercel.
- **Supabase Direct Access**: Many services already use Supabase directly (good), but some still try API calls first.
- **Railway Backend**: Only handles intelligence/filtering operations. Other operations use Vercel serverless or Supabase directly.

