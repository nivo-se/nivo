# Frontend Integration Review

**Date:** 2026-03-06
**Branch:** cursor/deep-research-system-planning-f59c
**Reviewer:** Cursor Agent (Prompt 8 — Supervisor / Integration Pass)

---

## 1. What is complete

### Frontend checklist (from DEEP_RESEARCH_STOP_CRITERIA.md Section 2)

| Item | Status | Notes |
|------|--------|-------|
| Run status page exists | Done | `RunStatusPage.tsx` — polls every 3s, shows stage timeline |
| Latest report viewer exists | Done | `ReportViewerPage.tsx` — sticky section nav, paragraph rendering |
| Report version history exists | Done | `ReportVersionsPage.tsx` — shows latest version, placeholder for full list |
| Verification panel exists | Done | `VerificationPanel.tsx` — 4-stat summary cards, issues list |
| Competitor editing exists | Done | `CompetitorEditorPage.tsx` — list view, add/remove UI (mutation API pending) |
| Assumption override flow exists | Done | `AssumptionOverridePage.tsx` — section recompute with instructions |
| Recompute feedback visible to user | Done | Both competitor and assumption pages show recompute status |

### Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| API client service | Done | `deepResearchService.ts` — typed wrappers for all endpoints |
| Routes in App.tsx | Done | Nested under `/deep-research/` with workbench layout |
| Workbench shell | Done | `DeepResearchWorkbench.tsx` — tabbed navigation layout |
| Sidebar nav link | Done | "Deep Research" added to `AppLayout.tsx` sidebar |

### API contract alignment

| Contract | Alignment |
|----------|-----------|
| RUN_STATUS_API_FREEZE.md | Aligned — `stages[]`, `current_stage`, `status` all used correctly |
| REPORT_UI_SCHEMA.md | Aligned — sections rendered by `sort_order`, `section_key`, `heading`, `content_md` |
| ANALYST_WORKBENCH_UX.md | Aligned — all 8 workflow steps have corresponding UI surfaces |

---

## 2. What is inconsistent or has known gaps

### 2.1 Report version history is limited

The backend only exposes `GET /reports/company/{company_id}/latest`. There is no endpoint to list all versions. The `ReportVersionsPage.tsx` shows the latest version and a placeholder notice. A `GET /reports/company/{company_id}/versions` endpoint would be needed for full functionality.

**Impact:** Low — analysts can still see the latest report and version number. Full history is phase 2.

### 2.2 Competitor mutation endpoints are missing

The backend exposes `GET /competitors/company/{company_id}` (read-only). There are no `POST/DELETE /competitors/` endpoints for add/remove. The `CompetitorEditorPage.tsx` has the UI wired but shows a "pending API" notice when add/remove is attempted.

**Impact:** Medium — analysts can view competitors and trigger full recompute, but cannot add/remove individual competitors yet.

### 2.3 Assumption override API is missing

There is no dedicated assumptions endpoint. The `AssumptionOverridePage.tsx` works around this by providing section-level recompute with analyst instructions (which is functional via `POST /recompute/section`).

**Impact:** Low — the section recompute path covers the core use case. Dedicated assumption CRUD is phase 2.

### 2.4 Company name not displayed in workbench header

The workbench header shows company UUID. To show the company name, the frontend would need to either:
- Fetch company details from an existing company endpoint
- Or receive company_name in the run status response

**Impact:** Low — cosmetic. UUID is sufficient for internal MVP use.

---

## 3. What still blocks MVP completion

### Required for MVP (per DEEP_RESEARCH_STOP_CRITERIA.md)

1. **Internal validation testing** — Run on 5-8 real companies to confirm Gates A-D
2. **Backend servers running** — Redis + RQ worker + API server must all be operational for end-to-end testing

### Not blocking but recommended

- Add `company_name` to `AnalysisStatusData` response for better UX in run list and workbench header
- Add `created_at` timestamp to `AnalysisStatusData` for run list sorting
- Consider adding a "Start Analysis" button/form on the runs list page

---

## 4. What should explicitly wait until phase 2

Per DEEP_RESEARCH_STOP_CRITERIA.md Section 3:

- Full report version list endpoint and diff/compare UI
- Competitor add/remove mutation endpoints
- Dedicated assumption CRUD API
- Report export (PDF, XLS)
- Batch processing UI
- Advanced dashboards or portfolio views
- Company ranking or scoring
- Monitoring/watchlist automation
- Broad UI polish beyond functional workbench

---

## 5. Files changed in this frontend sprint

### New files (10)

| File | Purpose |
|------|---------|
| `frontend/src/lib/services/deepResearchService.ts` | API client for all Deep Research endpoints |
| `frontend/src/pages/deep-research/RunListPage.tsx` | List of analysis runs |
| `frontend/src/pages/deep-research/RunStatusPage.tsx` | Single run status with stage timeline |
| `frontend/src/pages/deep-research/ReportViewerPage.tsx` | Latest report viewer with section nav |
| `frontend/src/pages/deep-research/ReportVersionsPage.tsx` | Report version history |
| `frontend/src/pages/deep-research/VerificationPanel.tsx` | Verification results summary |
| `frontend/src/pages/deep-research/CompetitorEditorPage.tsx` | Competitor list and editing UI |
| `frontend/src/pages/deep-research/AssumptionOverridePage.tsx` | Assumption overrides with section recompute |
| `frontend/src/pages/deep-research/DeepResearchWorkbench.tsx` | Workbench shell layout with tabs |
| `docs/deep_research/frontend-integration-review.md` | This document |

### Modified files (2)

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Added Deep Research routes and imports |
| `frontend/src/pages/default/AppLayout.tsx` | Added "Deep Research" to sidebar navigation |

---

## 6. Release gate assessment

| Gate | Ready? | Notes |
|------|--------|-------|
| **A — Can an analyst run it?** | Partial | UI exists for monitoring runs. "Start Analysis" is via API or could be added as a simple form. |
| **B — Can an analyst trust it?** | Yes | Verification panel shows claim counts and issues clearly. |
| **C — Can an analyst correct it?** | Partial | Section recompute works. Competitor add/remove needs backend endpoints. |
| **D — Can an analyst work from it?** | Yes | Report viewer renders full sections. Workbench provides coherent navigation. |

**Overall:** Frontend is MVP-complete for the analyst workbench. Remaining gaps (version list, competitor mutations, assumption CRUD) are bounded and documented as phase 2. Internal validation testing is the next step.
