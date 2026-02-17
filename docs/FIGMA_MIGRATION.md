# Figma Export → Nivo Backend Migration Guide

This document maps the **nivo-figma-app** (Figma export) API expectations to the **Nivo backend** and provides step-by-step migration instructions.

**Reference:** `nivo-figma-app/figma-export/BACKEND_INTEGRATION.md`  
**Backend:** `http://localhost:8000` (VITE_API_BASE_URL)  
**Frontend:** `http://localhost:8080`

---

## 1. API Endpoint Mapping

### Companies

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| `GET /api/companies` | `POST /api/universe/query` | Paginated. Use `limit`/`offset`, no all-at-once. |
| `GET /api/companies/:orgnr` | `GET /api/companies/{orgnr}/intel` + `POST /api/companies/batch` | Combine intel + batch for full company. |
| `GET /api/companies/search?q=` | `POST /api/universe/query` with `q` param | Same as Universe search. |

**Adapter:** `figmaApi.getCompanies()` → calls `queryUniverse({ limit: 500, offset: 0 })` and maps `UniverseRow[]` to `Company[]`.

### Lists

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| `GET /api/lists` | `GET /api/lists?scope=all` | ✅ Direct match. |
| `GET /api/lists/:listId` | `GET /api/lists/{listId}/items` + list metadata | Nivo returns `items` separately. |
| `POST /api/lists` | `POST /api/lists` or `POST /api/lists/from_query` | Use from_query when creating from Universe filters. |
| `PUT /api/lists/:listId` | ❌ Not implemented | Stub only. |
| `DELETE /api/lists/:listId` | `DELETE /api/lists/{listId}` | ✅ Direct match. |

**Adapter:** `figmaApi.getLists()` → `getLists('all')`, map `SavedList` to `List` with `companyIds` from `getListItems()`.

### Prospects

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| All prospects CRUD | ❌ Not implemented | **Stub:** return `[]`, no-ops for mutations. |

### AI Templates

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| All template CRUD | ❌ Not implemented | **Stub:** return `[]`, no-ops for mutations. |

### AI Runs

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| `GET /api/ai/runs` | `GET /api/analysis/runs` | Different response shape. |
| `GET /api/ai/runs/:runId` | `GET /api/analysis/runs/{run_id}` | Map `run_id` ↔ `id`, `stage` ↔ progress. |
| `POST /api/ai/runs` | `POST /api/analysis/start` | Different request body (min_revenue, etc. vs list_id, template_id). |
| `POST /api/ai/runs/:runId/cancel` | ❌ Not implemented | Stub. |

**Adapter:** Map Nivo `acquisition_runs` to Figma `AIRun` shape.

### AI Results

| Figma Expected | Nivo Backend | Notes |
|---------------|--------------|-------|
| `GET /api/ai/runs/:runId/results` | `GET /api/analysis/runs/{run_id}/companies` | Map `CompanyAnalysisResponse` → `AIResult`. |
| `POST /api/ai/results/:id/approve` | ❌ Not implemented | Stub. |
| `POST /api/ai/results/:id/reject` | ❌ Not implemented | Stub. |
| `GET /api/ai/profiles/:orgnr` | `GET /api/analysis/companies/{orgnr}/analysis` | Map to `AIProfile`. |

---

## 2. Type Mappings

### UniverseRow → Company

```ts
// UniverseRow has: orgnr, name, segment_names, has_homepage, has_ai_profile, ...
// Company needs: orgnr, display_name, legal_name, industry_label, revenue_latest, ...
function mapUniverseRowToCompany(row: UniverseRow): Company {
  return {
    orgnr: row.orgnr,
    display_name: row.name ?? row.orgnr,
    legal_name: row.name ?? row.orgnr,
    industry_label: row.segment_names?.[0] ?? 'Unknown',
    has_homepage: row.has_homepage,
    has_ai_profile: row.has_ai_profile,
    has_3y_financials: row.has_3y_financials,
    data_quality_score: row.data_quality_score,
    is_stale: row.is_stale,
    last_enriched_at: row.last_enriched_at ?? undefined,
    revenue_latest: row.revenue_latest ?? 0,
    ebitda_margin_latest: row.ebitda_margin_latest ?? 0,
    revenue_cagr_3y: row.revenue_cagr_3y ?? 0,
    employees_latest: row.employees_latest ?? 0,
    currency: 'SEK',
    years_available: 0,
    latest_year: new Date().getFullYear(),
    status: 'active',
    financials: [],
  };
}
```

### SavedList → List

```ts
// Nivo: { id, name, owner_user_id, scope, item_count }
// Figma: { id, name, owner_user_id, scope, companyIds, stage, filters }
// Fetch items separately and set companyIds = items.map(i => i.orgnr)
```

---

## 3. Migration Steps

### Phase 1: API Adapter (DONE)

- [x] Create `frontend/src/lib/services/figmaApi.ts` – maps Figma interface to Nivo backend
- [x] Create `frontend/src/types/figma.ts` – shared types for Figma app
- [x] Create `frontend/src/lib/hooks/figmaQueries.ts` – React Query hooks (replace `useData()`)

### Phase 2: Integrate nivo-figma-app into Nivo Frontend

1. **Copy components and pages** from `nivo-figma-app/src/` into `frontend/src/`:
   - Pages: `Universe`, `WorkDashboard`, `MyLists`, `ListDetail`, `Prospects`, `CompanyDetail`, `AILab`, `CreateRun`, `RunDetail`, `RunResults`, `Admin`
   - Shared components from `nivo-figma-app/src/app/components/`
   - Add routes in `frontend/src/App.tsx` or router config

2. **Replace DataContext** with `figmaApi` + React Query:
   - Remove `DataProvider` / `useData()`
   - Use `useCompanies()`, `useLists()`, etc. from `frontend/src/lib/hooks/figmaQueries.ts`

3. **Update imports** in copied pages:
   - `import { api } from '@/lib/services/figmaApi'`
   - `import type { Company, List, ... } from '@/types/figma'`

4. **Test incrementally** – Universe first, then Lists, then AI flows

### Phase 3: Remove Mock Data

- Delete `mockData.ts`, `mockAIData.ts` after migration
- Remove `DataContext.tsx` or replace with thin wrapper

---

## 4. Environment

```env
VITE_API_BASE_URL=http://localhost:8000
```

Frontend proxies `/api` → backend in `vite.config.ts`.

---

## 5. Stubbed Features (Return Empty / No-Op)

Until backend supports them:

- **Prospects:** `getProspects()` → `[]`, `createProspect`, `updateProspectStatus`, etc. → no-op
- **AI Templates:** `getPromptTemplates()` → `[]`, create/update/duplicate → no-op
- **AI Run Cancel:** `cancelAIRun()` → no-op (or 501)
- **Approve/Reject Result:** `approveResult`, `rejectResult` → no-op

This keeps the UI working without breaking; pages that rely on prospects/templates will show empty state.
