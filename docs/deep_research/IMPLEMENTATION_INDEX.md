# IMPLEMENTATION_INDEX.md

## Current focus: final task (live validation)

**To pick up the final task from another computer**, see **[FINAL_TASK_LIVE_VALIDATION.md](./FINAL_TASK_LIVE_VALIDATION.md)**. It describes how to run the Deep Research pipeline on two real companies (e.g. Segers Fabriker and Texstar), which services to start, and how to confirm the four release gates.

---

## Purpose

This file is the entry point for all Cursor cloud/web agent sessions related to the Nivo deep research system.

It tells each agent:

- which documents are authoritative
- which documents are planning vs implementation docs
- which files define contracts
- which files should not be reinterpreted or redesigned
- what order to read the docs in

Use this file as the **first referenced document** in every Cursor agent prompt.

---

## Rule of precedence

If multiple docs overlap, use this order of precedence:

1. `docs/deep_research/IMPLEMENTATION_INDEX.md`
2. `docs/deep_research/system_architecture.md` or equivalent top-level architecture doc
3. schema / API / orchestrator / retrieval specs
4. workflow / prompt / execution docs
5. older exploratory notes

If two docs conflict:

- do **not** silently redesign the system
- document the conflict
- follow the more recent implementation-oriented spec
- if still unclear, leave a note in `open_questions.md`

---

## Recommended read order for Cursor agents

Every agent should read documents in this order:

### 1. Core architecture and system intent
- `nivo-agent-analysis-system.md`
- architecture review / production system design docs
- end-to-end system architecture docs

### 2. Orchestration and agent behavior
- `langgraph-agent-orchestrator.md`
- `agent-prompts.md`
- any agent failure map / risk docs

### 3. Retrieval and evidence
- `retrieval-system-design.md`
- verification / source validation docs

### 4. Backend implementation
- `backend-implementation-plan.md`
- `database-schema-spec.md`
- `api-contract-spec.md`

### 5. Delivery / workflow docs
- Cursor execution docs
- implementation roadmap docs
- work breakdown / issue templates

---

## Suggested document roles

Below is the recommended role classification for the docs already in the repo.

### A. Architecture authority docs
These define the system and should not be casually changed.

- `nivo-agent-analysis-system.md`
- production system design doc
- end-to-end architecture doc
- langgraph orchestrator doc
- database schema spec
- API contract spec
- retrieval system design

### B. Implementation authority docs
These define how the system should be built.

- `backend-implementation-plan.md`
- coding plan / work breakdown docs
- Cursor execution plan docs

### C. Prompting / behavior docs
These define how agent prompts should behave.

- `agent-prompts.md`
- supervisor / integration docs
- any AGENTS/rules docs

### D. Reference-only docs
These are useful examples or context, but not direct contracts.

- Bruno Mathsson PDF reference
- exploratory research notes
- design memo examples

---

## Non-negotiable architecture rules

Cursor agents should assume the following are fixed unless explicitly instructed otherwise:

1. PostgreSQL is the system of record.
2. Public-source retrieval is the initial source strategy.
3. The pipeline is agentic but must be schema-first and evidence-first.
4. Claims must be traceable to sources.
5. Financial calculations must be deterministic and code-driven.
6. Competitor lists must be editable by humans.
7. Partial recompute is required.
8. Reports are interactive web reports, not static PDFs.
9. The system target is 50–100 companies with ~80% automation and human review on the final layer.

These rules are rooted in the core Nivo architecture and analysis workflow. fileciteturn0file0

---

## Out-of-scope redesigns for implementation agents

Unless explicitly requested, implementation agents must **not**:

- replace PostgreSQL with another primary database
- replace the core agent pipeline with an unrelated architecture
- redesign the product into a pure chat system
- remove verification / claims / evidence layers
- remove versioning
- replace deterministic financial modeling with pure LLM output
- invent new major services not justified by the existing docs

---

## Required output style for Cursor agents

For implementation tasks, Cursor agents should:

- modify only the files needed for the assigned scope
- respect existing package boundaries
- use typed models and explicit contracts
- add tests where appropriate
- leave concise implementation notes in changed files where needed
- avoid large opportunistic refactors outside task scope

---

## If the agent finds a conflict or blocker

The agent should:

1. implement the scoped work as far as possible
2. avoid speculative redesign
3. add a short note to `docs/deep_research/open_questions.md`
4. continue with a bounded best-effort implementation

---

## Suggested companion docs

This index is intended to be used together with:

- `CURSOR_CONTEXT_PLAYBOOK.md`
- root `AGENTS.md`
- optional `SUPERVISOR_INTEGRATION_CHECKLIST.md`
- `PROFILE_LEARNING_PIPELINE_DESIGN.md` — offline workflow for converting Deep Research reports into Layer 1 screening profiles (variables, weights, archetypes, exclusions)

