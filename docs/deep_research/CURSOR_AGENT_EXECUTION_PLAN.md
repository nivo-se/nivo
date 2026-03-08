# CURSOR_AGENT_EXECUTION_PLAN.md

## Purpose

This file defines the recommended multi-agent execution workflow for implementing the Nivo deep research backend using Cursor cloud/web agents.

It assumes that the core architecture docs already exist in `docs/deep_research`.

---

## Recommended total prompt count

Use **10 prompts total**:

1. planning prompt
2. foundations prompt
3. database prompt
4. API contracts / route skeletons prompt
5. retrieval prompt
6. orchestrator prompt
7. research agents prompt
8. competitor + strategy + value creation prompt
9. financial modeling + valuation + verification prompt
10. supervisor / integration prompt

This is the best balance between:
- context control
- parallelizable thinking
- limited overlap
- manageable review

---

## Prompt 1 — Planning agent

### Goal
Read the deep research docs and current repo state, then produce an execution plan.

### Inputs
- all docs in `docs/deep_research`
- repo structure

### Outputs
- `docs/deep_research/execution-plan.md`
- `docs/deep_research/module-dependency-map.md`
- `docs/deep_research/open-questions.md`

### Constraints
- minimal code changes
- do not implement the whole system
- focus on plan quality and sequencing

---

## Prompt 2 — Foundations

### Goal
Set up the project structure and shared package boundaries.

### In scope
- package scaffolding
- shared tooling
- base app structure
- dependency files
- make/test/lint scripts

### Out of scope
- business logic
- agents
- retrieval logic
- financial model

---

## Prompt 3 — Database

### Goal
Implement schema, migrations, and base persistence models.

### In scope
- DB models
- Alembic migrations
- versioning patterns
- seed/dev scripts

### Out of scope
- route logic
- full orchestrator logic

---

## Prompt 4 — API contracts and route skeletons

### Goal
Implement FastAPI DTOs, route shells, and common response patterns.

### In scope
- route files
- request/response models
- validation
- error contracts

### Out of scope
- full route internals
- orchestration logic

---

## Prompt 5 — Retrieval system

### Goal
Build the search/fetch/render/extract foundation.

### In scope
- query planner
- SerpAPI wrapper
- caching
- fetch/render pipeline
- source persistence interfaces

### Out of scope
- advanced report logic
- valuation
n
---

## Prompt 6 — Orchestrator

### Goal
Implement LangGraph state graph and workflow coordination.

### In scope
- AnalysisState
- node contracts
- graph wiring
- workflow persistence hooks
- retry handling scaffolding

### Out of scope
- deep agent prompt refinement
- frontend

---

## Prompt 7 — Core research agents

### Goal
Implement identity, company profile, and market analysis agents.

### In scope
- entity resolution
- company profiling
- market analysis
- structured output persistence

### Out of scope
- competitor system
- financial model

---

## Prompt 8 — Competitor + strategy + value creation

### Goal
Implement comparable discovery and thesis-building layers.

### In scope
- competitor discovery
- competitor profiling
- strategy analysis
- value creation initiatives
- edit-ready competitor data structures

### Out of scope
- deterministic valuation calculations

---

## Prompt 9 — Financial modeling + valuation + verification

### Goal
Implement deterministic numbers and anti-hallucination controls.

### In scope
- model assumptions
- projection engine
- valuation engine
- claims and verification plumbing

### Out of scope
- broad architecture changes

---

## Prompt 10 — Supervisor / integration prompt

### Goal
Review all implemented pieces, reconcile mismatches, and wire the happy path together.

### In scope
- schema/interface reconciliation
- import fixing
- mismatch detection
- route/service alignment
- final integration report

### Out of scope
- major redesign
- speculative new features

---

## Why a supervisor prompt is required

Without a final supervisor pass, multi-agent implementation often fails because:

- DTOs drift from DB models
- route contracts drift from service outputs
- orchestrator state differs from agent payloads
- naming diverges across modules
- tests pass locally but integration fails conceptually

The supervisor prompt exists to resolve exactly those issues.

---

## Execution rules

### Rule 1
Run prompts **sequentially**, not all at once.

### Rule 2
After each prompt:
- review diff
- commit/branch/PR
- confirm acceptance criteria
- only then move to next prompt

### Rule 3
Do not let an agent redesign prior architecture docs.

### Rule 4
If one prompt exposes a major conflict, update the docs first, then continue.

---

## Suggested branching model

Option A:
- one branch per prompt

Example:
- `deep-research-plan`
- `deep-research-foundations`
- `deep-research-db`
- `deep-research-api`
- `deep-research-retrieval`
- `deep-research-orchestrator`
- `deep-research-research-agents`
- `deep-research-competition-strategy`
- `deep-research-finance-verification`
- `deep-research-supervisor`

Option B:
- one long-lived feature branch, but one PR-sized commit group per prompt

Recommended:
- **Option A** if using Cursor cloud agents heavily
- **Option B** only if one person is actively integrating continuously

---

## Review checklist after each prompt

After each Cursor run, confirm:

- scoped files only were changed
- no accidental redesign occurred
- acceptance criteria were met
- new docs are consistent with existing docs
- tests or sanity checks were added when appropriate

---

## Required artifacts from each prompt

Each prompt should end by producing:

1. summary of code changes
2. list of changed files
3. acceptance criteria status
4. blockers / open questions
5. recommended next prompt

---

## Recommended storage location

Save this file at:

`docs/deep_research/CURSOR_AGENT_EXECUTION_PLAN.md`

