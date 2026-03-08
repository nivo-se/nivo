# CURSOR_AGENT_RULES.md

## Purpose

This document defines the mandatory implementation rules for Cursor agents working on the Nivo Deep Research platform.

These rules exist to prevent:
- architecture drift
- naming inconsistency
- unverifiable outputs
- duplicated abstractions
- broken module boundaries
- agent sessions rewriting each other’s work

These rules apply to all implementation prompts related to the Deep Research system.

---

## 1. Source of Truth

The source of truth for this system is the documentation in:

- `docs/deep_research/IMPLEMENTATION_INDEX.md`
- `docs/deep_research/CURSOR_CONTEXT_PLAYBOOK.md`
- `docs/deep_research/13_database-schema-spec.md`
- `docs/deep_research/12_backend-implementation-plan.md`
- `docs/deep_research/11_retrieval-system-design.md`
- `docs/deep_research/08_agent-prompts.md`
- `docs/deep_research/07_langgraph-agent-orchestrator.md`

If code and docs conflict, do not silently invent a new architecture.
Instead:
1. follow the newer and more specific spec if it is clear
2. document the inconsistency
3. make the smallest change needed

---

## 2. Architecture Freeze

Do not redesign the core architecture.

Do not:
- replace the agent pipeline with a different architecture
- rename core modules casually
- introduce new high-level services without a clear need
- swap out PostgreSQL / FastAPI / LangGraph-based design unless explicitly required

The approved high-level architecture is:

- FastAPI backend
- PostgreSQL + pgvector
- retrieval layer
- LangGraph orchestrator
- agent pipeline
- verification layer
- report generation layer

---

## 3. Respect Module Boundaries

Use the agreed service boundaries.

Expected backend structure:

- `backend/api`
- `backend/agents`
- `backend/orchestrator`
- `backend/retrieval`
- `backend/verification`
- `backend/report_engine`
- `backend/services`
- `backend/models`
- `backend/db`
- `backend/common`
- `backend/config`

Do not move logic into random locations.

Rules:
- API routes belong in `api`
- persistence models belong in `models` / `db`
- orchestration belongs in `orchestrator`
- web research belongs in `retrieval`
- validation and fact-checking belong in `verification`
- report assembly belongs in `report_engine`

---

## 4. Do Not Rename Core Domain Entities

The following domain entities are stable and should not be casually renamed:

- Company
- Financials
- Run
- Source
- SourceChunk
- Claim
- CompanyProfile
- MarketAnalysis
- CompetitorRelation
- CompetitorProfile
- Strategy
- ValueCreationInitiative
- ModelAssumption
- FinancialModel
- FinancialModelLine
- Valuation
- Report
- ReportVersion
- UserEdit
- RecomputeRequest

If a rename is absolutely necessary, document why.

---

## 5. Schema-First Development

Always implement in this order:

1. define or confirm schema
2. define interface / contract
3. implement service logic
4. add tests
5. wire integration

Do not write large free-form business logic before schemas exist.

For all request/response contracts, use typed models.

---

## 6. Never Invent Data

This is a research system.

Agents and supporting services must never:
- fabricate facts
- fabricate competitors
- fabricate valuation multiples
- fabricate market sizes
- fabricate claims
- silently convert unknown into certainty

If data is missing:
- return `unknown`
- return low confidence
- mark claim as unsupported or uncertain
- preserve traceability

---

## 7. Claims Must Be Traceable

All report-visible research claims must be traceable to sources.

Every meaningful claim should have:
- `claim_text`
- `verification_status`
- `confidence_score`
- one or more `source_refs`

Do not produce narrative-only outputs without claim support.

---

## 8. Unsupported Claims Must Not Be Promoted

Unsupported claims must not appear in final report narrative as if they were verified facts.

Allowed behaviors:
- omit unsupported claims
- label them as uncertain
- surface them in verification views

Disallowed behavior:
- polishing uncertain claims into confident prose

---

## 9. Deterministic Financial Logic Only

Financial calculations must be deterministic and code-driven.

Allowed:
- Python-based formulas
- bounded assumptions
- scenario modeling
- explicit assumption objects

Not allowed:
- LLM-generated spreadsheet math without coded logic
- hidden calculation steps
- unstated assumptions

LLMs may propose assumptions, but the backend must calculate outputs.

---

## 10. Minimize Architecture Drift Between Prompts

Each Cursor agent should implement only the assigned scope.

Do not:
- refactor unrelated modules
- rename packages outside your task
- “improve” unrelated architecture
- rewrite existing contracts unless required

If you find a cross-cutting issue:
- document it
- make the minimum safe change
- avoid opportunistic refactors

---

## 11. Preserve Backward Compatibility Within the Repo

When implementing a new module:
- do not break existing imports without updating all call sites
- do not change response shapes without aligning the API spec
- do not change DB model semantics without checking migrations

Prefer additive changes over destructive ones.

---

## 12. Small, Reviewable Changes

Implement in small logical commits.

Prefer:
- one feature per commit
- one module group per PR
- code that can be reviewed independently

Avoid giant mixed diffs unless explicitly requested.

---

## 13. Logging and Observability Are Required

For all major services, include structured logging.

At minimum, log:
- run_id
- company_id
- stage_name
- service/module
- status
- timing where relevant

Do not build opaque pipelines.

---

## 14. Error Handling Rules

Handle errors explicitly.

Soft-fail when:
- one source fetch fails
- one competitor profile fails
- some fields are unknown

Hard-fail when:
- company identity is unresolved
- run state becomes invalid
- critical schema assumptions break
- verification blocks report generation

Do not swallow exceptions silently.

---

## 15. Testing Rules

Every meaningful implementation should include tests where feasible.

Minimum expectations:
- schema/model tests
- service-level unit tests
- integration tests for key flow boundaries

At least add tests for:
- database model creation
- API validation
- retrieval parsing
- orchestration state transitions
- financial model calculations
- verification behavior

---

## 16. No Hidden Magic

Avoid:
- over-abstracted helper layers with unclear purpose
- premature generic frameworks
- dynamic behavior that hides data flow

Prefer explicit, readable code over clever abstractions.

This is a system that will evolve through many agent sessions.
Clarity matters more than elegance.

---

## 17. Prompt Scope Is Binding

For any given Cursor run:
- only do the requested scope
- treat out-of-scope items as notes, not implementation targets

If additional work is clearly needed:
- leave TODOs
- document blockers
- do not silently expand the task into a much larger rewrite

---

## 18. Required End-of-Task Output

At the end of each Cursor task, provide:

1. what was implemented
2. files changed
3. decisions made
4. assumptions made
5. remaining issues / TODOs
6. anything that may conflict with the docs

This summary should be concise and PR-friendly.

---

## 19. If Documents Conflict

If multiple docs conflict:

1. prefer the most recent and implementation-specific doc
2. prefer schema specs over high-level architecture summaries
3. prefer API contract specs over inferred route shapes
4. prefer database schema spec over ad hoc model invention

If still unclear:
- document the ambiguity
- implement the least risky option
- do not invent a new architecture direction

---

## 20. Deep Research-Specific Non-Negotiables

These rules are mandatory:

- competitor lists must be editable
- recompute must support partial reruns
- report content must be versioned
- sources must be stored
- claims must be verifiable
- final report must be interactive-structure friendly
- financial modeling must be deterministic
- architecture must remain modular

---

## 21. Practical Instruction for Cursor Agents

At the start of each task:

1. read the relevant docs
2. restate the task scope
3. identify impacted modules
4. avoid unrelated changes
5. implement only what is necessary
6. summarize results clearly at the end

---

## 22. Success Criterion

A successful Cursor task is one that:

- respects the documented architecture
- keeps the codebase coherent
- produces verifiable, typed, reviewable output
- makes the next bounded task easier

Not one that produces the most code.