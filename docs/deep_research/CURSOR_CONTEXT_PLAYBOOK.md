# CURSOR_CONTEXT_PLAYBOOK.md

## Purpose

This document defines the best way to feed context into Cursor cloud/web agents for the Nivo deep research implementation.

The goal is to avoid the most common failure modes:

- too much context with no focus
- missing authoritative docs
- agents redesigning instead of implementing
- overlapping or conflicting code changes
- prompts that are broad but not testable

---

## Core principle

Every Cursor agent prompt should include **only the context needed for that task**, but it must always include the architecture authority layer first.

Use this prompt structure:

1. mission
2. in-scope work
3. out-of-scope work
4. files to read first
5. files allowed to change
6. required outputs
7. acceptance criteria
8. implementation constraints

---

## Default context bundle for every Cursor agent

Every implementation agent should receive these references first:

1. `docs/deep_research/IMPLEMENTATION_INDEX.md`
2. the most relevant task-specific spec document
3. current repo structure
4. any existing files in the module being changed

### Example default docs by domain

#### For DB and models
- `IMPLEMENTATION_INDEX.md`
- `database-schema-spec.md`
- `backend-implementation-plan.md`
- existing `/packages/domain` and DB code

#### For APIs
- `IMPLEMENTATION_INDEX.md`
- `api-contract-spec.md`
- `backend-implementation-plan.md`
- existing `/apps/api` code

#### For retrieval
- `IMPLEMENTATION_INDEX.md`
- `retrieval-system-design.md`
- `agent-prompts.md`
- existing `/packages/retrieval` code

#### For orchestrator
- `IMPLEMENTATION_INDEX.md`
- `langgraph-agent-orchestrator.md`
- `backend-implementation-plan.md`
- existing `/apps/worker` and `/packages/agents` code

---

## The best prompt frame for Cursor web agents

Use this structure almost verbatim.

```text
You are implementing a bounded part of the Nivo deep research platform.

Read first:
1. docs/deep_research/IMPLEMENTATION_INDEX.md
2. [task-specific doc]
3. [secondary supporting doc]

Task:
[clear implementation scope]

In scope:
- [list]

Out of scope:
- [list]

Files you may modify:
- [paths]

Files you must not redesign unless necessary:
- [paths]

Required outputs:
- [deliverables]

Acceptance criteria:
- [testable bullets]

Implementation constraints:
- schema-first
- evidence-first
- do not redesign architecture
- preserve existing naming unless necessary
- add tests where practical

At the end, provide:
1. summary of changes
2. unresolved issues
3. follow-up tasks
```

---

## Context sizing rules

### Include
- the one main spec for the task
- one supporting spec
- current relevant code
- acceptance criteria

### Avoid including all docs every time
Do **not** load all 14+ docs into every prompt unless the task truly requires it.

That causes:
- context dilution
- confused prioritization
- architecture drift

---

## Task boundary rules

Every prompt should explicitly state:

### In scope
What the agent should implement now.

### Out of scope
What the agent must leave untouched.

This is important for web agents because they are powerful enough to refactor beyond the intended boundary if the prompt is vague.

---

## File permission model for prompts

Each prompt should define file boundaries.

### Example

```text
Files you may modify:
- apps/api/**
- packages/domain/**

Files you may read but should not redesign:
- docs/deep_research/**
- packages/modeling/**

Files you must not modify in this task:
- apps/frontend/**
- infra/**
```

This reduces accidental overlap between cloud-agent sessions.

---

## Recommended prompt types

### Type 1 — Planning prompt
Purpose:
- inspect repo
- read authoritative docs
- produce execution plan

Should not do broad implementation.

### Type 2 — Bounded implementation prompt
Purpose:
- implement one subsystem
- follow one main spec
- create code plus tests

### Type 3 — Supervisor / integration prompt
Purpose:
- inspect prior implementation work
- identify mismatches
- reconcile schemas and interfaces
- patch integration issues only

---

## Acceptance criteria pattern

Every prompt should end with explicit acceptance criteria.

### Good example

```text
Acceptance criteria:
- SQLAlchemy models compile
- Alembic migration runs cleanly
- 3 unit tests added
- no unrelated files changed
- route schemas match api-contract-spec.md
```

### Bad example

```text
Acceptance criteria:
- backend improved
```

---

## Best way to reference markdown docs in prompts

Use short, authoritative phrasing:

```text
Use `docs/deep_research/database-schema-spec.md` as the source of truth for table and field design.
Use `docs/deep_research/api-contract-spec.md` as the source of truth for request/response contracts.
Do not redesign those unless required to fix a contradiction, and if so document it clearly.
```

---

## Suggested context bundles by planned prompt

### Planning prompt
- `IMPLEMENTATION_INDEX.md`
- all deep_research docs
- current repo tree

### Foundations prompt
- `IMPLEMENTATION_INDEX.md`
- `backend-implementation-plan.md`
- repo tree

### DB prompt
- `IMPLEMENTATION_INDEX.md`
- `database-schema-spec.md`
- `backend-implementation-plan.md`

### API prompt
- `IMPLEMENTATION_INDEX.md`
- `api-contract-spec.md`
- `backend-implementation-plan.md`

### Retrieval prompt
- `IMPLEMENTATION_INDEX.md`
- `retrieval-system-design.md`
- `agent-prompts.md`

### Orchestrator prompt
- `IMPLEMENTATION_INDEX.md`
- `langgraph-agent-orchestrator.md`
- `backend-implementation-plan.md`

### Research agents prompt
- `IMPLEMENTATION_INDEX.md`
- `agent-prompts.md`
- `retrieval-system-design.md`
- `langgraph-agent-orchestrator.md`

### Financial prompt
- `IMPLEMENTATION_INDEX.md`
- modeling / valuation specs
- `backend-implementation-plan.md`

### Supervisor prompt
- `IMPLEMENTATION_INDEX.md`
- all implementation specs
- changed files / PRs / branches

---

## What each agent should output at the end

Every Cursor web agent should end with:

1. **Summary of changes**
2. **Files changed**
3. **Acceptance criteria checklist**
4. **Known issues / blockers**
5. **Suggested next prompt**

This makes multi-agent handoff much easier.

---

## Hard guardrails for Cursor prompts

Always include these constraints:

- Do not redesign the architecture.
- Do not rename domain entities unless necessary.
- Do not make unrelated refactors.
- If a conflict is found, document it instead of inventing a new structure.
- Preserve versioning and evidence traceability.
- Keep financial modeling deterministic.

---

## Recommended storage location

Save this file at:

`docs/deep_research/CURSOR_CONTEXT_PLAYBOOK.md`

Reference it in every major cloud-agent session.

