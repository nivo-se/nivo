# AGENTS.md

## Purpose

This repository is the Nivo monorepo: apps, API, and deep research tooling.

All coding agents working in this repo must follow the implementation architecture defined in `docs/deep_research`.

Before making substantial changes, read:

1. `docs/deep_research/IMPLEMENTATION_INDEX.md`
2. the task-specific spec document
3. the current module code you are modifying

## Deep Research implementation
When working on the Nivo deep research system, always read and follow:

- docs/deep_research/IMPLEMENTATION_INDEX.md
- docs/deep_research/CURSOR_CONTEXT_PLAYBOOK.md
- docs/deep_research/CURSOR_AGENT_RULES.md

---

## Project intent

This system is evidence-first, agentic research and investment analysis. Do not describe Nivo as an “intelligence platform” in user-facing or marketing copy.

It must:

- ingest internal company financials
- enrich analysis with public web data
- generate structured analysis across company, market, competitors, strategy, value creation, financial modeling, valuation, and reporting
- keep claims tied to sources
- support partial recompute after human edits

---

## Non-negotiable implementation rules

1. PostgreSQL is the source of truth.
2. Claims must be traceable to sources.
3. Retrieval must preserve raw artifacts and extracted evidence.
4. Financial modeling must be deterministic and code-driven.
5. Reports must be versioned.
6. Competitor sets must support human editing.
7. Do not replace the architecture with a simpler chat-only workflow.
8. Do not overwrite prior analysis versions in place.

---

## Coding rules

- Prefer small, scoped changes.
- Respect package boundaries.
- Use typed models and explicit interfaces.
- Avoid broad refactors outside the task scope.
- Preserve existing naming unless there is a strong reason to change it.
- Add tests where practical.
- Document blockers instead of inventing speculative redesigns.

---

## Prompt discipline

When working from a task prompt:

- implement only what is in scope
- do not assume out-of-scope redesign permission
- if a contradiction is found, document it and continue with best-effort bounded implementation

---

## Expected output from coding agents

At the end of each task, provide:

1. a concise summary of changes
2. files changed
3. acceptance criteria status
4. blockers or follow-up items

---

## Deep research docs directory

Primary docs live under:

`docs/deep_research/`

These docs define architecture, orchestrator behavior, schema, API contracts, retrieval design, and execution workflow.

