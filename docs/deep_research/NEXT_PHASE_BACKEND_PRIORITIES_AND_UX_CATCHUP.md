
# NEXT_PHASE_BACKEND_PRIORITIES_AND_UX_CATCHUP.md

## Purpose

This document defines the **next development phase for the Nivo Deep Research platform** following the successful integration milestone (commit `fbe21f7`).

The backend pipeline is already capable of:

- End‑to‑end execution
- Claim persistence
- Verification pipeline execution
- Report generation
- Report versioning
- DB‑backed APIs

The focus of the next phase is to:

1. Harden backend reliability and product readiness
2. Enable real analyst workflows
3. Prepare the system for a usable frontend

This document is divided into two parts:

**Part 1 — Backend Priorities (1–5)**  
**Part 2 — UX Catch‑up Plan**

---

# PART 1 — BACKEND PRIORITIES

## Priority 1 — Asynchronous Run Execution

### Problem

The endpoint:

```
POST /analysis/start
```

currently executes the **entire LangGraph pipeline synchronously**.

This causes:

- long request blocking
- poor UX
- inability to monitor progress
- no cancellation capability
- difficulty scaling

### Target Architecture

Convert analysis execution into **async job processing**.

### Proposed Flow

1. API receives request
2. API creates `analysis_run` row
3. API pushes `run_id` into queue
4. Worker pulls run_id
5. Worker executes LangGraph pipeline
6. Worker updates stage progress
7. Report generated when pipeline finishes

### Required Components

| Component | Purpose |
|--------|--------|
Queue | manage execution jobs |
Worker | execute pipeline |
Run table | track progress |
Run stages | stage status updates |

### Suggested Technologies

- Redis queue
- Celery / RQ / Dramatiq
- or custom worker loop

### Run Status Model

Run states:

```
PENDING
RUNNING
PARTIAL_SUCCESS
FAILED
SUCCEEDED
```

### Definition of Done

- `analysis/start` returns immediately
- pipeline runs in background
- frontend can poll progress

---

## Priority 2 — Recompute Execution Wiring

### Problem

Current recompute endpoints are **stubs**.

Examples:

- recompute/section
- recompute/report
- competitor compute only reads DB

This prevents the system from behaving like an **editable analyst system**.

### Target Capability

Users must be able to:

- edit competitors
- edit assumptions
- override market data
- regenerate sections or full report

### Recompute Dependency Matrix

| Edit Type | Stages to Recompute |
|-----------|--------------------| competitor change | competitor profiling → strategy → value creation → financial model → valuation → verification → report |
| assumption override | financial model → valuation → verification → report |
| market override | market → competitors → strategy → financial model → valuation → verification → report |

### Execution Model

Recompute should:

1. create a new run
2. mark it as `recompute`
3. reuse upstream outputs when possible
4. rerun only necessary stages

### Definition of Done

- edits trigger recompute runs
- recompute produces new report version
- previous runs preserved

---

## Priority 3 — Verification Hardening

### Current State

Verification checks:

- evidence existence
- confidence thresholds

Normal mode allows pipeline continuation even if evidence is weak.

### Risks

- unsupported claims appear in reports
- numeric facts insufficiently verified
- valuation inputs weakly supported

### Improvements

Introduce stronger claim validation rules.

### Claim Types

| Claim Type | Verification Requirement |
|-----------|--------------------------|
Numeric facts | ≥1 high‑quality source |
Market metrics | ≥2 sources preferred |
Competitor facts | ≥1 company or database source |
Valuation assumptions | ≥1 credible market reference |
Strategic insights | evidence recommended |

### Verification Status Types

```
SUPPORTED
UNSUPPORTED
UNCERTAIN
CONFLICTING
```

### Report Composer Changes

Report generator should:

- block unsupported numeric claims
- mark uncertain statements
- avoid hallucinated facts

### Definition of Done

- unsupported facts cannot appear as verified narrative
- verification outputs visible via API

---

## Priority 4 — Retrieval Resilience

### Problem

Retrieval currently fails when:

- page fetch fails
- extraction fails
- search results are noisy

### Required Improvements

#### Fetch Layer

- retry transient failures
- detect blocked requests
- timeout safeguards

#### Extraction Layer

- improved HTML cleaning
- boilerplate removal
- fallback extraction

#### Search Improvements

- domain ranking
- duplicate suppression
- recency scoring

#### Metadata Persistence

Store:

- fetch status
- extraction confidence
- source type
- domain authority score

### Metrics to Track

| Metric | Description |
|------|-------------|
fetch success rate | % of pages fetched |
extraction success rate | % of structured extractions |
search duplication rate | repeated domains |
average evidence quality | retrieval quality |

### Definition of Done

- retrieval failures degrade gracefully
- evidence quality improves

---

## Priority 5 — Dedicated Verification Persistence

### Problem

Verification state currently lives in:

- run_node_state
- claim flags

This makes:

- debugging harder
- analytics harder
- UI review panels harder

### Proposed Table

`claim_verifications`

Fields:

```
verification_id
run_id
claim_id
status
confidence_score
verified_at
source_ids
notes
```

### Benefits

- history of verification results
- improved API clarity
- UI verification panels easier to implement

### Definition of Done

- verification results persisted
- verification API reads from table

---

# PART 2 — UX CATCH‑UP PLAN

The backend has advanced faster than the frontend.

The UI must now catch up by exposing the backend capabilities.

The goal is **an analyst workbench**, not a polished presentation UI.

---

## UX Screen 1 — Analysis Run Status

Purpose:

Allow users to monitor pipeline progress.

### Display

- company name
- run ID
- pipeline stage progress
- start time
- completion status

### Component

```
RunProgressTimeline
```

---

## UX Screen 2 — Latest Report Viewer

Purpose:

Allow analysts to read the generated analysis report.

### Sections

1. Executive Summary
2. Company Profile
3. Market Landscape
4. Strategy & Value Creation
5. Financial Model & Valuation

### Features

- section navigation
- markdown rendering
- citation indicators

---

## UX Screen 3 — Report Version History

Purpose:

Expose report versioning.

### Display

- version number
- creation time
- run ID
- verification status

### Features

- version comparison
- select version to view

---

## UX Screen 4 — Competitor Review Panel

Purpose:

Enable human correction of competitor sets.

### Features

- competitor list
- website link
- remove competitor
- add competitor
- mark competitor type

### Actions

Trigger recompute.

---

## UX Screen 5 — Verification Panel

Purpose:

Build trust in AI outputs.

### Display

- supported claims
- unsupported claims
- uncertain claims
- linked evidence sources

---

## UX Screen 6 — Assumption Review

Purpose:

Allow analysts to inspect model assumptions.

### Display

- growth assumptions
- margin assumptions
- valuation multiple assumptions

### Actions

Override assumptions and rerun model.

---

# UX Development Priority

Recommended UI implementation order:

1. Run Status Page
2. Report Viewer
3. Version History
4. Verification Panel
5. Competitor Editor
6. Assumption Editor

---

# Final Goal

After these backend and UX improvements, the system should support:

1. Running automated company analysis
2. Monitoring pipeline execution
3. Reviewing generated reports
4. Inspecting verification results
5. Editing competitors and assumptions
6. Recomputing analysis safely
7. Tracking report versions

At that point the Nivo Deep Research platform becomes a **usable analyst product rather than a technical prototype**.
