# Nivo Deep Research Documentation Pack

This pack defines the target architecture and implementation plan for upgrading Nivo's deep research workflows from a prompt-led pipeline into a policy-driven `research-to-valuation` system.

## Recommended reading order

1. `01-target-architecture.md`
2. `02-report-spec-schema.md`
3. `03-policy-framework.md`
4. `04-evidence-and-assumption-registry.md`
5. `05-query-compiler-and-retrieval.md`
6. `06-orchestration-and-stage-gates.md`
7. `07-deterministic-valuation-engine.md`
8. `08-ux-workflow.md`
9. `09-implementation-roadmap.md`
10. `10-open-questions-and-backlog.md`

## Core design principle

All report runs should flow through the same canonical spine:

`report_spec -> validated_evidence_bundle -> assumption_registry -> deterministic_valuation -> final_report`

The LLM should help with:
- scope building
- retrieval planning
- evidence extraction
- synthesis
- report narration

The LLM should not directly own:
- valuation math
- policy rules
- consistency checks
- final assumption acceptance

## Document pack contents

### 01-target-architecture.md
Target operating model, system boundaries, and stage outputs.

### 02-report-spec-schema.md
Machine-readable contract for every research run.

### 03-policy-framework.md
Versioned policy objects for DCF, multiples, evidence, and uncertainty.

### 04-evidence-and-assumption-registry.md
Canonical data contracts for evidence items and assumptions.

### 05-query-compiler-and-retrieval.md
Policy-aware query generation and parameter retrieval patterns.

### 06-orchestration-and-stage-gates.md
Workflow stages, validators, rerun behavior, and failure modes.

### 07-deterministic-valuation-engine.md
Deterministic valuation service requirements and interfaces.

### 08-ux-workflow.md
Operational UX for launching, monitoring, and reviewing deep research runs.

### 09-implementation-roadmap.md
Tight phased build plan for implementation.

### 10-open-questions-and-backlog.md
Outstanding design choices and backlog candidates.

## Intended use

These documents are meant to become the basis for:
- backend implementation tickets
- Cursor/Codex prompts
- architecture reviews
- frontend workflow planning
- validator and schema design
- future ADRs

## Suggested next step

Turn this pack into repository docs under:

```text
docs/deep_research/tightning/
```

and then implement Phase 1 from `09-implementation-roadmap.md`.
