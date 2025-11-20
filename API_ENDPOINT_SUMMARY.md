# API Endpoint Summary

## Quick Reference: What Calls What

### ✅ Working Endpoints (Railway Backend)

These endpoints are correctly configured and working:

| Frontend Component | Endpoint | Service | Status |
|-------------------|----------|---------|--------|
| `FinancialFilterPanel` | `/api/filters/analytics` | `intelligenceService` | ✅ Working |
| `FinancialFilterPanel` | `/api/filters/apply` | `intelligenceService` | ✅ Working |
| `AIDeepDivePanel` | `/api/companies/{orgnr}/ai-report` | `intelligenceService` | ✅ Working |
| `intelligenceService` | `/api/companies/{orgnr}/intel` | Railway | ✅ Working |
| `intelligenceService` | `/api/jobs/enrich` | Railway | ✅ Working |
| `intelligenceService` | `/api/jobs/{job_id}` | Railway | ✅ Working |
| `intelligenceService` | `/api/ai-reports/generate` | Railway | ✅ Working |
| `intelligenceService` | `/api/ai-reports/generate-batch` | Railway | ✅ Working |

### ⚠️ Vercel Serverless Functions

These endpoints are Vercel serverless functions (work when frontend is on Vercel):

| Frontend Component | Endpoint | Status |
|-------------------|----------|--------|
| `AIAnalysis.tsx` | `/api/ai-analysis` | ⚠️ Vercel serverless |
| `Valuation.tsx` | `/api/valuation` | ⚠️ Vercel serverless |
| `analysisRunsService.ts` | `/api/analysis-runs` | ⚠️ Vercel serverless |
| `savedListsService.ts` | `/api/saved-lists` | ⚠️ Vercel serverless (has Supabase fallback) |

### ✅ Direct Supabase Access

These components use Supabase directly (no API calls needed):

| Component | Data Source | Status |
|-----------|-------------|--------|
| `supabaseDataService.ts` | Direct Supabase queries | ✅ Working |
| `supabaseCompanyService.ts` | Direct Supabase queries | ✅ Working |
| `WorkingDashboard.tsx` | `supabaseDataService` | ✅ Working |
| `EnhancedCompanySearch.tsx` | `supabaseCompanyService` | ✅ Working |

### ❌ Missing/Not Implemented

| Endpoint | Called By | Status |
|----------|-----------|--------|
| `/api/search/vector` | `intelligenceService.vectorSearch()` | ❌ Not implemented in Railway |

## Configuration Status

### ✅ Correctly Configured

- **Railway Backend**: `https://vitereactshadcnts-production-fad5.up.railway.app`
- **Vercel Frontend**: Uses `VITE_API_BASE_URL` environment variable
- **intelligenceService**: Uses `VITE_API_BASE_URL` or localhost in dev
- **CORS**: Railway allows Vercel domains

### ⚠️ Needs Attention

- **Saved Lists**: Tries API first, falls back to Supabase (works but logs errors)
- **AI Analysis**: Uses Vercel serverless (works on Vercel, not on Railway)
- **Valuation**: Uses Vercel serverless (works on Vercel, not on Railway)

## Testing Checklist

After deployment, test these:

- [x] Railway health check: `/health`
- [ ] Financial Filters analytics: `/api/filters/analytics`
- [ ] Financial Filters apply: `/api/filters/apply`
- [ ] AI Report generation: `/api/ai-reports/generate`
- [ ] Company intelligence: `/api/companies/{orgnr}/intel`
- [ ] Dashboard analytics: Direct Supabase queries
- [ ] Company search: Direct Supabase queries
- [ ] Saved lists: Supabase fallback (API will fail but fallback works)

