# FRONTEND_IMPLEMENTATION_PROMPTS.md

## Purpose

This document contains the **bounded Cursor prompts** for implementing the remaining frontend/workbench portion of the Nivo Deep Research MVP.

These prompts assume the backend has already reached the current milestone:
- async run execution either implemented or in progress
- run status API exists
- report generation and versioning exist
- verification APIs exist
- recompute APIs exist or are close to usable

Each prompt should be run in a **separate Cursor agent session**.

Each prompt should target a **separate feature branch**.

---

# Global instruction block

Prepend this to every Cursor frontend prompt.

```text
Before making any changes, read:

- AGENTS.md
- docs/deep_research/IMPLEMENTATION_INDEX.md
- docs/deep_research/CURSOR_CONTEXT_PLAYBOOK.md
- docs/deep_research/CURSOR_AGENT_RULES.md
- docs/deep_research/FRONTEND_INTEGRATION_PLAN.md
- docs/deep_research/RUN_STATUS_API_FREEZE.md
- docs/deep_research/REPORT_UI_SCHEMA.md
- docs/deep_research/ANALYST_WORKBENCH_UX.md
- docs/deep_research/ANALYST_WORKBENCH_MVP_PLAN.md
- docs/deep_research/DEEP_RESEARCH_STOP_CRITERIA.md

These documents are binding for this task.

Important rules:
1. Do not redesign the backend architecture.
2. Do not change API contracts casually.
3. Implement only the scope of this task.
4. Keep changes minimal and reviewable.
5. If a backend contract mismatch is found, document it clearly instead of inventing a new contract.

At the start of the task:
- summarize the scope
- identify affected frontend modules/routes/components
- state what will be implemented

At the end of the task:
- summarize what was built
- list files changed
- note blockers, assumptions, and follow-up items
```

---

# Prompt 1 — Run Status Page

## Goal
Implement the analysis run status UI so analysts can monitor pipeline progress.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research run status page.

Goal:
Create a frontend route and component set that displays the status of an analysis run using the run status API.

Requirements:
- Create a page for a single run
- Fetch run status from the existing backend endpoint
- Render:
  - company id or company name if available
  - run status
  - current stage
  - ordered stage list
  - started_at / finished_at when available
- Show clear loading, empty, and failure states
- Make the stage list readable and visually structured
- Do not add speculative UI features beyond the current API contract

Suggested components:
- RunStatusHeader
- RunProgressTimeline
- StageStatusItem
- RunStatusBadge

Definition of Done:
- a user can open a run and understand what the system is doing
- the screen works against the current API contract
```

Suggested branch:
`dr-ui-run-status`

---

# Prompt 2 — Latest Report Viewer

## Goal
Implement the main report viewer for the latest report version.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research latest report viewer.

Goal:
Create a frontend route and reusable components that render the latest report using the existing report API and report JSON structure.

Requirements:
- Create a page for latest report by company
- Render the report title/meta/version info
- Render report sections in order
- Support markdown content safely
- Add section navigation/sidebar if practical
- Render verification/report badges if available in the payload
- Keep the structure aligned with REPORT_UI_SCHEMA.md
- Do not redesign report contracts

Suggested components:
- ReportPageHeader
- ReportSectionNav
- ReportSectionRenderer
- ReportBlockRenderer
- ReportMetaBar

Definition of Done:
- a user can open the latest report and read it end-to-end from the UI
```

Suggested branch:
`dr-ui-report-viewer`

---

# Prompt 3 — Report Version History

## Goal
Expose report version history so analysts can inspect and compare reruns.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research report version history UI.

Goal:
Create a route or panel that lists report versions for a company and allows opening a selected version.

Requirements:
- Fetch version list from backend
- Render:
  - version number
  - created timestamp
  - report status
  - triggering run id if available
- Allow selecting a version and navigating to/opening it
- Keep UI simple and audit-focused rather than highly polished

Suggested components:
- ReportVersionList
- ReportVersionItem
- ReportVersionBadge
- VersionLinkAction

Definition of Done:
- an analyst can inspect previous report versions without using the backend directly
```

Suggested branch:
`dr-ui-report-versions`

---

# Prompt 4 — Verification Panel

## Goal
Make trust visible by exposing verification results and weak claims.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research verification panel.

Goal:
Create a UI surface that shows claim verification status for a run or report.

Requirements:
- Fetch verification summary from the backend
- Render:
  - supported count
  - unsupported count
  - uncertain count
  - conflicting count if present
- If unsupported claims endpoint exists, render claim rows
- Show claim text, claim type, stage, and status where available
- Keep the UI inspection-oriented, not decorative

Suggested components:
- VerificationSummaryCard
- VerificationStatusBadge
- UnsupportedClaimsList
- ClaimStatusRow

Definition of Done:
- an analyst can quickly see whether a report is trustworthy and where the weak spots are
```

Suggested branch:
`dr-ui-verification-panel`

---

# Prompt 5 — Competitor Editor

## Goal
Implement the first key human-in-the-loop correction workflow.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research competitor editor UI.

Goal:
Allow analysts to view, add, remove, and update competitors, then trigger recompute.

Requirements:
- Fetch competitor list from backend
- Render competitor name, website if available, comparable type, and any useful metadata already exposed
- Support:
  - add competitor
  - remove competitor
  - update comparable type if backend supports it
- After edits, show recompute result or enqueue state
- Keep the flow backend-contract-safe and minimal

Suggested components:
- CompetitorList
- CompetitorRow
- AddCompetitorForm
- CompetitorTypeSelector
- RecomputeNotice

Definition of Done:
- analysts can adjust competitors without touching the database or code
```

Suggested branch:
`dr-ui-competitor-editor`

---

# Prompt 6 — Assumption Review and Override

## Goal
Implement the second key human-in-the-loop correction workflow.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research assumption review and override UI.

Goal:
Allow analysts to inspect key financial/model assumptions and override them safely.

Requirements:
- Fetch assumptions from backend if endpoint exists
- Render assumption key, current value, rationale, and source/metadata when available
- Support editing and posting assumption overrides
- After override, surface recompute feedback clearly
- Focus on a practical analyst tool, not a full spreadsheet UI

Suggested components:
- AssumptionList
- AssumptionRow
- AssumptionOverrideForm
- OverrideSubmitBar
- RecomputeStatusNotice

Definition of Done:
- analysts can adjust assumptions and trigger a new downstream run safely
```

Suggested branch:
`dr-ui-assumption-overrides`

---

# Prompt 7 — Analyst Workbench Shell

## Goal
Connect the individual UI pieces into a coherent analyst workflow.

## Prompt

```text
Follow the global instruction block first.

Implement the Deep Research analyst workbench shell.

Goal:
Create the navigation and screen structure that ties together:
- run status
- latest report
- version history
- verification
- competitors
- assumptions

Requirements:
- Build a company-level workbench layout
- Add tabs, sidebar, or section navigation as appropriate
- Make it easy to move between:
  - current run
  - current report
  - verification
  - competitors
  - assumptions
- Preserve existing pages/components where possible
- Avoid unnecessary redesign of unrelated app sections

Suggested components:
- DeepResearchWorkbenchLayout
- CompanyWorkbenchHeader
- WorkbenchNav
- WorkbenchPanelContainer

Definition of Done:
- the frontend feels like one usable analyst tool rather than disconnected pages
```

Suggested branch:
`dr-ui-workbench-shell`

---

# Prompt 8 — Frontend Supervisor / Integration Pass

## Goal
Align all new frontend work with the backend contracts and stop drift before launch.

## Prompt

```text
Follow the global instruction block first.

You are acting as a principal frontend engineer reviewing the Deep Research workbench implementation.

Goal:
Inspect the implemented frontend surfaces and ensure they align with the documented backend contracts and MVP stop criteria.

Tasks:
1. Review all Deep Research frontend routes/components
2. Check consistency with:
   - RUN_STATUS_API_FREEZE.md
   - REPORT_UI_SCHEMA.md
   - ANALYST_WORKBENCH_MVP_PLAN.md
   - DEEP_RESEARCH_STOP_CRITERIA.md
3. Identify contract mismatches, naming drift, or duplicate concepts
4. Make only the minimum safe fixes needed
5. Produce a concise integration note:
   docs/deep_research/frontend-integration-review.md

The review note must include:
- what is complete
- what is inconsistent
- what still blocks MVP completion
- what should explicitly wait until phase 2

Definition of Done:
- frontend workbench is coherent
- contract drift is minimized
- remaining MVP gaps are explicit and bounded
```

Suggested branch:
`dr-ui-supervisor-integration`

---

# Recommended execution order

1. Run Status Page
2. Latest Report Viewer
3. Report Version History
4. Verification Panel
5. Competitor Editor
6. Assumption Review and Override
7. Analyst Workbench Shell
8. Frontend Supervisor / Integration Pass

---

# Hard stop reminder

Do not expand beyond the analyst workbench MVP during this phase.

The purpose of these prompts is to finish Deep Research, not to begin phase 2 platform expansion.
