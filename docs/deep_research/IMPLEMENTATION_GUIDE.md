# IMPLEMENTATION_GUIDE.md

## Purpose
Guide engineers or Cursor agents through implementing the next product phase.

## Phase 1: Async Pipeline Execution
Convert `analysis/start` to asynchronous execution.

Steps:
1. Create run row
2. Push run_id to queue
3. Worker executes LangGraph pipeline
4. Update run status per stage

## Phase 2: Run Status API
Expose pipeline progress for frontend polling.

## Phase 3: Report Viewer
Render latest report with section navigation.

## Phase 4: Version History
Expose previous report versions.

## Phase 5: Competitor Editing
Allow analysts to modify competitors and trigger recompute.

## Phase 6: Verification Panel
Display supported vs unsupported claims.

## Cursor Usage
Use Cursor prompts per module rather than large multi‑file changes.