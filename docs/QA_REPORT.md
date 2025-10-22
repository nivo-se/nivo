# Nivo Vercel QA & UX Audit

## Scope
- Verified dashboard overview metrics, company search flows, AI Insight workflow, valuation flows, and saved list interoperability after Vercel deployment.
- Focused on regression fixes affecting Supabase fallbacks, saved list behaviour, and clarity of AI-driven experiences.

## Key Fixes
### Dashboard Overview
- Added resilient analytics aggregation that falls back to bundled demo data when Supabase credentials are missing or the query returns no rows.
- Ensures key KPI cards display realistic values instead of `N/A` in staging and production environments without Supabase access.

### Company Search
- Loading a saved list now works on first click.
- List selections instantly hydrate filters, selections, and summary metrics to remove double-click requirement.

### AI Insight Workflow
- Centralised saved list loading so AI Insights and AI Analysis Workflow use the same Supabase/localStorage service.
- Added a guided usage panel describing input, processing, and refinement loops.
- Enabled deep links back to the search tab for managing lists.

### Valuation Page
- Swapped legacy REST fetches for Supabase-backed searches with API fallback.
- Introduced saved list picker so search lists can seed valuation runs.
- Added list metadata preview, inline list loading, and management link to maintain parity with search experience.

### Navigation & UX
- Working dashboard reads `?view=` or `?tab=` query parameters so deep links from the report land on the relevant tool.

## Outstanding Checks
- ESLint configuration is still using deprecated `.eslintrc` format; lint command fails until repo migrates to the new flat config (`eslint.config.js`).

## Manual Smoke Tests
- Dashboard overview renders fallback analytics without Supabase keys.
- Saved lists sync between search, AI Insight, and valuation flows (localStorage fallback).
- AI workflow highlights cost guidance and allows full-run on mock data.
- Valuation export (CSV/XLS/PDF) still functional after list-driven company selection.
