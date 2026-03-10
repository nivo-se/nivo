# Deep Research UX Workflow

## Purpose

This document describes the MVP Deep Research UX workflow implemented for the Nivo app. It covers the operational landing page, New Report launch wizard, and Research Run workspace.

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/deep-research` | DeepResearchHomePage | Deep Research start; merged list of runs and companies with reports |
| `/deep-research/companies` | Redirect | Redirects to `/deep-research` |
| `/deep-research/runs` | RunListPage | Admin-only list of analysis runs |
| `/deep-research/runs/:runId` | RunStatusPage | Research Run workspace with stage progression |
| `/deep-research/company/:companyId/*` | DeepResearchWorkbench | Report viewer, versions, verification, competitors, assumptions |

## 1. Deep Research Home (`/deep-research`)

- **Page title:** Deep Research
- **Subtext:** Evidence-first research and investment analysis. Launch reports, monitor progress, and access completed analysis.
- **Primary CTA:** New report (opens wizard modal)
- **Search/filter:** Input for company name or org nr; status filter chips (All, Not started, Running, Complete, Blocked)
- **List:** Cards with company name, org nr, created date, current stage, overall status, Open report / Details button

**Data sources:** `listRuns()` and `listCompaniesWithReports()` merged client-side.

**Status mapping:**
- `pending` → Not started
- `running` → Running
- `completed` → Complete
- `failed` → Blocked
- `cancelled` → Cancelled

## 2. New Report Wizard

**Trigger:** New report button on Deep Research Home.

**Steps:**
1. **Company selection** — Search by name or org nr (Universe API); show matched company preview; manual fallback (name + optional orgnr/website)
2. **Research mode** — Quick Screen, Standard Deep Research, Full IC Prep (maps to `analysis_type`: quick, full, full)
3. **Analyst context** — Optional free-text: "What should the report focus on?" → `query`
4. **Advanced settings** — Accordion: prioritize market, prioritize competitors, include valuation, refresh vs reuse cache
5. **Preflight summary** — Data signals (financials found, website found, prior report exists); risk message; CTA "Run report"

**On submit:** Calls `startAnalysis()`, navigates to `/deep-research/runs/:runId`.

## 3. Research Run Workspace (`/deep-research/runs/:runId`)

**Layout:** Two-column
- **Left rail:** Stage progression (vertical list)
- **Main panel:** Active content

**Stage labels (backend → display):**
- identity → Company resolution
- company_profile → Company understanding
- web_retrieval → Web intelligence
- market_analysis → Market synthesis
- competitor_discovery → Competitors
- strategy → Strategy / value creation
- value_creation → (merged with strategy; not shown separately)
- financial_model → Financial grounding
- valuation → Valuation
- verification → Verification
- report_generation → Final report

**Stage status:** Queued, Running, Passed, Blocked, Skipped.

**Main panel:**
- **Running:** Current stage name, activity text
- **Completed:** View Report button
- **Blocked/Failed:** BlockedStageCard with stage name, reason (`error_message`), suggested actions

## 4. Blocked-State UX

When a stage fails or run fails:
- Show stage name, reason (from `error_message`), suggested next actions
- **Suggested actions (static mapping):**
  - identity → Add company website, Verify org nr
  - company_profile, market_analysis, competitor_discovery → Broaden search, Lower strictness
  - web_retrieval → Check Tavily key, Add company website
  - default → Rerun with more context, Add company website

## 5. Backend API Extensions

- **RunStageData:** Added `error_message`
- **AnalysisStatusData:** Added `orgnr`, `created_at`, `error_message`
- **list_runs / get_run_status:** Return `created_at`, `orgnr`, `error_message`; stages include `error_message`

## 6. Frontend Types

- `ResearchRunSummary` — Unified run summary for Home list
- `ResearchMode` — quick | standard | full
- `RunStage` — Extended with `error_message`
- `AnalysisStatus` — Extended with `orgnr`, `created_at`, `error_message`

## 7. Implementation Notes

- Default flow is minimal: Steps 1–2 required; 3–5 optional
- Advanced options hidden under accordion (Step 4)
- Preflight "Prior report exists" requires backend support to match Universe company to deep_research company; MVP shows false
- Company search uses `searchCompanySummaries` (Universe API)
- Manual company entry: backend `resolve_company` creates/looks up deep_research company by orgnr or company_name
