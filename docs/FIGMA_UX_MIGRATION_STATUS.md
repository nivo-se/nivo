# Figma UX Migration Status

**Document Version:** 1.0  
**Date:** 2026-02-17  
**Purpose:** Page-by-page inventory of Figma UX implementation, mock data removal, and API integration status.

---

## Executive Summary

| Metric | Status |
|--------|--------|
| Default route | `/` → redirects to `/new` (Figma app) |
| Figma pages implemented | 12/12 in `frontend/src/pages/new/*` |
| Mock data in default routes | None – uses figmaApi/figmaQueries |
| Backend stubs (throw/empty) | Prospects, AI Templates, updateList, cancelAIRun, approve/reject |
| Legacy UI location | Under `/legacy/*` (to be added) |

---

## Figma Export vs Nivo Implementation

### Figma Export Structure (`/nivo-figma-app`)

| Page | Figma File | Mock Source | DataContext Methods |
|------|------------|-------------|---------------------|
| Root | Root.tsx | DataProvider | All |
| WorkDashboard | WorkDashboard.tsx | companies, lists, prospects | getCompanies, getLists, getProspects |
| Universe | Universe.tsx | companies, createList | companies, createList |
| MyLists | MyLists.tsx | lists, deleteList | lists, deleteList |
| ListDetail | ListDetail.tsx | getList, updateList, companies, addToProspects | All above |
| CompanyDetail | CompanyDetail.tsx | getCompany, getCompanyAIProfile | getCompany, getCompanyAIProfile |
| Prospects | Prospects.tsx | prospects, getCompany, updateProspectStatus, addProspectNote, etc. | Full prospect CRUD |
| AILab | AILab.tsx | promptTemplates, aiRuns, lists, templates CRUD | Templates, runs, lists |
| CreateRun | CreateRun.tsx | getTemplate, getList, createAIRun | AI run creation |
| RunDetail | RunDetail.tsx | getAIRun, getList, getTemplate, getRunResults, cancelAIRun | AI run detail |
| RunResults | RunResults.tsx | getAIRun, getRunResults, getCompany, getTemplate, approveResult, rejectResult | AI results |
| Admin | Admin.tsx | lists, prospects, aiRuns, companies | Summary stats |

**Figma Mock Files (DELETE after full migration):**
- `nivo-figma-app/src/app/data/mockData.ts` – 13k companies, types
- `nivo-figma-app/src/app/data/mockAIData.ts` – AI templates, runs, results
- `nivo-figma-app/src/app/data/DataContext.tsx` – Context wrapping mock data

---

## Nivo Implementation (frontend/src/pages/new/*)

### Migration Status Table

| Page/Route | File Path | Mock Data Removed | API/Hooks Used | Status | Notes/Risks |
|------------|-----------|-------------------|----------------|--------|-------------|
| Dashboard | `new/WorkDashboard.tsx` | ✓ | useLists, useProspects, useAIRuns | Done | Prospects empty (stub) |
| Prospects | `new/Prospects.tsx` | ✓ | useProspects, mutations | Done | All mutations throw – backend missing |
| Universe | `new/Universe.tsx` | ✓ | useCompanies, useCreateList, useCreateListFromQuery | Done | POST /api/universe/query, from_query |
| MyLists | `new/MyLists.tsx` | ✓ | useLists, useDeleteList | Done | GET /api/lists, DELETE |
| ListDetail | `new/ListDetail.tsx` | ✓ | useList, useCompaniesBatch, addToList, removeFromList, useCreateListFromQuery | Done | updateList throws |
| CompanyDetail | `new/CompanyDetail.tsx` | ✓ | useCompany, useCompanyAIProfile, getCompaniesBatch | Done | GET /api/analysis/companies/:orgnr/analysis |
| AILab | `new/AILab.tsx` | ✓ | useLists, usePromptTemplates, useAIRuns | Done | Templates empty (stub), Create Run works |
| CreateRun | `new/CreateRun.tsx` | ✓ | useList, usePromptTemplate, useCreateAIRun | Done | Uses filter-based start (no list_id) |
| RunDetail | `new/RunDetail.tsx` | ✓ | useAIRun, useList, useRunResults, useCancelAIRun | Done | cancelAIRun throws |
| RunResults | `new/RunResults.tsx` | ✓ | useAIRun, useRunResults, useApproveResult, useRejectResult | Done | approve/reject throw |
| Admin | `new/Admin.tsx` | ✓ | useLists, useProspects, useAIRuns, getLastApiErrors | Done | Contracts + smoke tests |
| Layout | `new/NewAppLayout.tsx` | ✓ | AuthContext | Done | No mock |

---

## API Mapping (figmaApi.ts)

| Figma Expected | Nivo Backend | Status |
|---------------|--------------|--------|
| GET companies | POST /api/universe/query | ✓ Mapped |
| GET company | POST /api/universe/query (q=orgnr) | ✓ Mapped |
| GET lists | GET /api/lists | ✓ Mapped |
| GET list + items | GET /api/lists, GET /api/lists/:id/items | ✓ Mapped |
| POST create list | POST /api/lists | ✓ Mapped |
| POST create list from query | POST /api/lists/from_query | ✓ Mapped |
| PUT update list | — | ❌ Stub (throws) |
| DELETE list | DELETE /api/lists/:id | ✓ Mapped |
| POST add items | POST /api/lists/:id/items | ✓ Mapped |
| DELETE remove item | DELETE /api/lists/:id/items/:orgnr | ✓ Mapped |
| GET prospects | — | ❌ Stub (returns []) |
| POST create prospect | — | ❌ Stub (throws) |
| PATCH update prospect | — | ❌ Stub (throws) |
| POST add prospect note | — | ❌ Stub (throws) |
| GET AI templates | — | ❌ Stub (returns []) |
| POST create template | — | ❌ Stub (throws) |
| GET AI runs | GET /api/analysis/runs | ✓ Mapped |
| GET AI run | GET /api/analysis/runs/:id | ✓ Mapped |
| POST create AI run | POST /api/analysis/start | ✓ Mapped (filter-based) |
| POST cancel AI run | — | ❌ Stub (throws) |
| GET run results | GET /api/analysis/runs/:id/companies | ✓ Mapped |
| POST approve result | — | ❌ Stub (throws) |
| POST reject result | — | ❌ Stub (throws) |
| GET company AI profile | GET /api/analysis/companies/:orgnr/analysis | ✓ Mapped |
| POST companies batch | POST /api/companies/batch | ✓ Mapped |

---

## Backend Endpoints (Actual)

**Exist and used:**
- POST /api/universe/query
- GET /api/universe/filters
- GET /api/lists
- POST /api/lists
- POST /api/lists/from_query
- GET /api/lists/:list_id/items
- POST /api/lists/:list_id/items
- DELETE /api/lists/:list_id/items/:orgnr
- DELETE /api/lists/:list_id
- POST /api/companies/batch
- GET /api/analysis/runs
- GET /api/analysis/runs/:run_id
- POST /api/analysis/start
- GET /api/analysis/runs/:run_id/companies
- GET /api/analysis/companies/:orgnr/analysis

**Missing (stubbed in frontend):**
- PUT /api/lists/:id (update list name/scope/stage)
- Prospects: full CRUD
- AI Templates: full CRUD
- POST /api/analysis/runs/:id/cancel
- POST /api/ai/results/:id/approve
- POST /api/ai/results/:id/reject

---

## Mock Data Usage in Nivo Frontend (Default Routes)

**Checked:** No mock data modules are imported by `frontend/src/pages/new/*`.  
All new pages use `figmaQueries.ts` → `figmaApi.ts` → real backend or stubbed responses.

**Legacy routes (to move under /legacy):**
- `IndustryFilter.tsx`, `CollapsibleIndustryFilter.tsx` – import `sampleData`
- `supabaseDataService.ts` – import `sampleData`
- `localDataService.ts` – mock fallback when API unavailable
- `EnhancedCompanySearch.tsx` – mock fallback for historical data
- `ValuationModelsCard.tsx` – mock when API unavailable
- `AdvancedAnalyticsDashboard.tsx` – mock data
- `analysisService.ts`, `analysisRunsService.ts` – mock for dev

These are used by: `/app/*`, `WorkingDashboard`, `Valuation`, `AnalysisPage`, etc. – not by default `/new/*` routes.

---

## Route Mapping

| Figma Route | Nivo Route | Component |
|-------------|------------|-----------|
| / | /new (redirect) | NewAppLayout → WorkDashboard |
| /universe | /new/universe | Universe |
| /lists | /new/lists | MyLists |
| /lists/:id | /new/lists/:listId | ListDetail |
| /company/:id | /new/company/:companyId | CompanyDetail |
| /prospects | /new/prospects | Prospects |
| /ai | /new/ai | AILab |
| /ai/run/create | /new/ai/run/create | CreateRun |
| /ai/runs/:id | /new/ai/runs/:runId | RunDetail |
| /ai/runs/:id/results | /new/ai/runs/:runId/results | RunResults |
| /admin | /new/admin | Admin |

---

## Files Changed (Migration)

- `frontend/src/App.tsx` – Root at `/`, legacy under `/legacy/*`, `/new/*` redirects
- `frontend/src/pages/new/NewAppLayout.tsx` – Nav paths `/` instead of `/new`
- `frontend/src/pages/new/*.tsx` – Internal links updated, component imports fixed
- `frontend/src/pages/new/Admin.tsx` – Extended smoke tests (5 steps)

## Remaining Gaps (Backend Missing)

- Prospects: full CRUD
- AI Templates: full CRUD
- PUT /api/lists/:id (update list)
- POST /api/analysis/runs/:id/cancel
- approve/reject AI results

## How to Run Locally

```bash
# Backend
cd backend && uvicorn api.main:app --reload

# Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

## Verify After Deploy

1. Root `/` loads Dashboard
2. Admin → Run smoke tests (all 5 pass)
3. Universe, Lists, Company detail, AI Lab work
4. See docs/PROD_SMOKE_TEST.md
