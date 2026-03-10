# PLANNER_LAUNCH_INSTRUCTIONS_HARD_STOP.md
Status: Execution Control Specification  
Purpose: Provide a complete operating procedure for launching a new implementation planner for the Nivo Deep Research system, with a strict hard stop to prevent uncontrolled scope expansion.

---

# 1. Objective

You want to launch a new planner that will design and coordinate implementation of:

- Nivo Deep Research v2 or v3
- Responses API orchestration
- Agents SDK workflow
- Tavily / web research integration
- valuation intelligence
- memo generation pipeline

The planner must not drift into unlimited architecture brainstorming.

It must stop at a defined boundary and produce a specific output package.

This document defines that boundary.

---

# 2. Core Rule

The planner is not allowed to:

- redesign the entire business
- speculate beyond implementation scope
- continue endlessly into future enhancements
- rewrite already accepted architecture unless it finds a blocking issue

The planner must produce an implementation plan and then stop.

---

# 3. Hard Stop Definition

## Hard Stop Trigger

The planner must stop once it has completed all of the following deliverables:

1. implementation workstreams
2. system component breakdown
3. database / state requirements
4. API / tool integration plan
5. agent list and ownership
6. phased rollout plan
7. critical risks and blockers
8. explicit “not in scope for phase 1” section

Once these are complete, the planner must output:

`PLANNING COMPLETE — HARD STOP REACHED`

and must not continue expanding the architecture.

---

# 4. Planner Deliverables

The planner’s output must contain exactly these sections:

## Section 1 — Objective
What is being built and why.

## Section 2 — Current State
What exists today.

## Section 3 — Target State
What the implementation should achieve.

## Section 4 — Workstreams
Break the implementation into workstreams.

Recommended workstreams:

- orchestration
- agent development
- evidence / research storage
- validation layer
- valuation layer
- memo generation
- observability / tracing
- rollout / QA

## Section 5 — Component Breakdown
List all components that must be built or modified.

## Section 6 — Data / State Requirements
What DB tables, run states, and artifacts are required.

## Section 7 — API & Tool Plan
Which APIs / tools are required and where they fit.

## Section 8 — Phased Rollout
Phase 1, Phase 2, Phase 3.

## Section 9 — Risks / Blockers
Only real implementation risks.

## Section 10 — Out of Scope
Explicitly list what is not part of the immediate implementation.

## Section 11 — Final Recommended Build Order
Ordered build list.

Then stop.

---

# 5. What the Planner Must NOT Do

The planner must not:

- create additional future-state “nice to have” docs
- propose multiple competing grand strategies beyond a short comparison
- invent product strategy changes
- start prompt-writing unless explicitly requested
- create code unless explicitly requested
- continue with “next possible ideas” after the hard stop

---

# 6. Launch Mode Options

When launching the planner, choose one mode.

## Mode A — v2 Implementation Planner
For the orchestrated non-swarm system.

## Mode B — v3 Swarm Implementation Planner
For the parallel research swarm architecture.

## Mode C — staged rollout planner
For:
- phase 1 = v2
- phase 2 = selected v3 upgrades

Recommended default:
Mode C.

---

# 7. Best Practical Mode for Nivo

Recommended planner target:

## Stage 1
Build the v2 foundation:
- resolver
- research agents
- evidence validator
- valuation validator
- memo writer
- reviewer
- tracing

## Stage 2
Add selected v3 upgrades:
- evidence lake
- contradiction grouping
- synthesizer
- full swarm mode

This avoids overbuilding too early while preserving the long-term architecture.

---

# 8. Exact Planner Launch Prompt

Use the following as the planner prompt.

---

## START PROMPT

You are the implementation planner for the Nivo Deep Research system.

Your job is to produce a practical implementation plan for building the new research workflow using the already approved architecture documents.

You must use the approved docs as the source of truth and convert them into an execution-ready plan.

Primary source documents:
- NIVO_DEEP_RESEARCH_MASTER_SPEC.md
- VALUATION_INTELLIGENCE_SPEC.md
- DEEP_RESEARCH_AGENT_PROMPTS_PRO.md
- AGENT_WORKFLOW_DIAGRAMS.md
- NIVO_DEEP_RESEARCH_V3_SWARM_ARCHITECTURE.md

Target planning mode:
MODE C — staged rollout planner

Your output must include only these sections:
1. Objective
2. Current State
3. Target State
4. Workstreams
5. Component Breakdown
6. Data / State Requirements
7. API & Tool Plan
8. Phased Rollout
9. Risks / Blockers
10. Out of Scope
11. Final Recommended Build Order

Rules:
- stay implementation-focused
- do not rewrite the entire architecture
- do not produce extra speculative future ideas
- do not create code
- do not create prompts unless absolutely required for implementation sequencing
- where uncertain, make a grounded recommendation rather than opening new branches
- once all required sections are complete, print exactly:
PLANNING COMPLETE — HARD STOP REACHED

This is a hard stop. Do not continue after that line.

## END PROMPT

---

# 9. Recommended Attachments for the Planner Run

When you launch the planner, attach:

1. NIVO_DEEP_RESEARCH_MASTER_SPEC.md
2. VALUATION_INTELLIGENCE_SPEC.md
3. DEEP_RESEARCH_AGENT_PROMPTS_PRO.md
4. AGENT_WORKFLOW_DIAGRAMS.md
5. NIVO_DEEP_RESEARCH_V3_SWARM_ARCHITECTURE.md

Optional:
- Bruno memo PDF
- current Nivo backend flow docs
- current DB schema
- current orchestration files

---

# 10. Recommended Human Instructions Before Launch

Give the planner these practical constraints:

- build for maintainability first
- keep phase 1 tight
- do not assume unlimited engineering resources
- prioritize the architecture changes with highest memo-quality impact
- explicitly separate must-build from nice-to-have

Recommended additional line:

`Assume the goal is to get to a first high-quality production version, not a perfect final-state research lab.`

---

# 11. Quality Checklist for the Planner Output

Before accepting the plan, verify that it contains:

- a clear phased rollout
- explicit workstreams
- identifiable deliverables
- ownership boundaries between agents
- DB / run-state requirements
- validation layer tasks
- valuation layer tasks
- memo generation tasks
- observability / tracing tasks
- explicit out-of-scope list
- exact hard-stop line at the end

If one of these is missing, reject the plan and rerun with tighter instructions.

---

# 12. How to Enforce the Hard Stop in Practice

If using a planner agent interactively:

1. provide only the approved docs
2. provide the exact launch prompt above
3. tell it that anything after the hard-stop line is invalid
4. reject outputs that continue beyond the hard-stop line

If using a workflow runner:
- parse the output
- terminate acceptance at the hard-stop line
- discard any content after it

---

# 13. Suggested Follow-Up Sequence After Planner Completion

After the planner has stopped, the next jobs should be launched separately:

1. architecture implementation task writer
2. database migration planner
3. orchestrator coding plan
4. agent-by-agent implementation plan
5. QA / eval plan

Do not mix those into the planner step.

That separation is important.

---

# 14. Summary

This document gives you a controlled way to launch a new planner without letting the exercise expand forever.

The planner should:
- use the approved architecture docs
- convert them into an implementation plan
- stop after the required sections
- print the hard-stop line
- end there
