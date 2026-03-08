# FRONTEND_INTEGRATION_PLAN.md

## Purpose
Define the frontend architecture and UI surfaces required to integrate with the Deep Research backend pipeline.

## Key Screens
1. Analysis Run Status
2. Latest Report Viewer
3. Report Version History
4. Competitor Review & Editing
5. Verification Panel
6. Assumption Review

## UI Route Map
/dashboard
/company/{id}
/company/{id}/report/latest
/company/{id}/report/versions
/company/{id}/verification
/company/{id}/competitors

## Components
- RunProgressTimeline
- ReportSectionRenderer
- VerificationBadge
- CompetitorEditor
- VersionHistoryList
- ClaimEvidenceViewer

## Data Fetch Strategy
- Poll `/analysis/runs/{run_id}` for progress
- Fetch latest report via `/reports/company/{company_id}/latest`
- Fetch verification summary via `/verification/runs/{run_id}`

## State Model
Use React Query or SWR for API state management.