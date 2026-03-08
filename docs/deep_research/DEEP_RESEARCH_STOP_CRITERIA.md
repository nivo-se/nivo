# DEEP_RESEARCH_STOP_CRITERIA.md

## Purpose

This document defines the **hard stop** for the Nivo Deep Research function.

It exists to prevent the Deep Research system from turning into an endless architecture and feature-expansion project.

The core rule is simple:

> Deep Research is finished when it is a usable internal analyst tool.

That means:
- analysts can run the research flow
- analysts can inspect and trust the outputs
- analysts can correct key inputs
- analysts can rerun safely
- analysts can use the system without developer hand-holding

Everything beyond that is **phase 2**, not required for Deep Research MVP completion.

---

# 1. Final Definition of Deep Research MVP

The Deep Research function is considered **complete** when all of the following are true.

## 1.1 Run execution
An analyst can:
- start an analysis run
- receive a run id immediately
- monitor pipeline progress while the run executes asynchronously

## 1.2 Run visibility
An analyst can:
- see current stage
- see completed stages
- see failed stages
- understand whether a run succeeded, partially succeeded, or failed

## 1.3 Report access
An analyst can:
- open the latest generated report
- navigate the report sections
- view report versions
- distinguish new vs prior report versions

## 1.4 Verification visibility
An analyst can:
- see supported claims
- see unsupported claims
- see uncertain/conflicting claims
- inspect the evidence/source support behind the report

## 1.5 Human correction loop
An analyst can:
- edit competitors
- override assumptions
- optionally override market framing if supported
- trigger safe recompute of the relevant downstream stages

## 1.6 Version-safe recompute
When edits are made:
- a new run is created
- prior outputs are preserved
- a new report version is generated
- version history remains understandable

## 1.7 Real internal usability
A small internal user group can use the system on real companies without requiring engineers to manually fix runs, read the database directly, or patch the flow during normal usage.

---

# 2. Hard Stop Checklist

Deep Research is **done** when the following checklist is fully true.

## Backend checklist
- [ ] analysis runs execute asynchronously
- [ ] run status API exposes ordered stage progress
- [ ] report generation works reliably
- [ ] report versions increment safely
- [ ] verification results are persisted
- [ ] unsupported claims are surfaced clearly
- [ ] competitor-related recompute works
- [ ] assumption-related recompute works
- [ ] retrieval failures degrade gracefully
- [ ] failures are observable through logs and run state

## Frontend checklist
- [ ] run status page exists
- [ ] latest report viewer exists
- [ ] report version history exists
- [ ] verification panel exists
- [ ] competitor editing exists
- [ ] assumption override flow exists
- [ ] recompute feedback is visible to user

## Validation checklist
- [ ] tested on multiple real companies
- [ ] tested on at least one weak-data case
- [ ] tested on at least one ambiguous-data case
- [ ] analysts can complete the workflow without developer support

If all three groups are true, the Deep Research MVP is complete.

---

# 3. What Is Explicitly Out of Scope for MVP

The following items are **not required** to finish Deep Research MVP.

## 3.1 Advanced AI scope
- new agent stages
- autonomous multi-step research expansion
- broader market intelligence engines
- sector-specific agent specialization
- advanced narrative rewriting

## 3.2 Advanced product scope
- highly polished presentation UI
- export-to-deck systems
- advanced dashboards
- cross-company portfolio views
- sourcing/watchlist automation
- automated company ranking
- automated target scoring
- collaborative commenting systems

## 3.3 Advanced infrastructure scope
- large-scale batch orchestration
- aggressive optimization for hundreds of runs
- autoscaling worker fleets
- advanced scheduling systems
- enterprise-grade observability stack

These are all valid future improvements, but they are **not required for Deep Research MVP completion**.

---

# 4. Phase 2 Boundary

Once Deep Research MVP is complete, all additional work must be labeled **Phase 2**.

Phase 2 may include:
- better retrieval quality
- better claim verification policies
- broader UX polish
- better financial modeling depth
- sector templates
- company ranking
- watchlists and monitoring
- scale improvements
- export/report polish

The key rule:

> Do not reopen Deep Research core scope after MVP is declared complete.

From that point forward, changes should be framed as enhancements to a finished capability.

---

# 5. Release Decision Gate

Before declaring Deep Research finished, confirm the following questions.

## Gate A — Can an analyst run it?
Can a non-developer start a run and follow progress?

## Gate B — Can an analyst trust it?
Can a non-developer inspect verification and understand weak claims?

## Gate C — Can an analyst correct it?
Can a non-developer edit competitors or assumptions and rerun safely?

## Gate D — Can an analyst work from it?
Can the generated output be used as a meaningful first-pass investment research artifact?

If the answer to all four is yes, Deep Research is finished.

---

# 6. Recommended Internal Completion Statement

Use the following wording internally when the project reaches the stop line:

> The Nivo Deep Research MVP is complete. The system now supports asynchronous company analysis, run monitoring, report generation, claim verification visibility, analyst edits, and version-safe recompute. Further work is categorized as phase 2 improvement, not core Deep Research development.

This helps stop the natural drift into endless platform expansion.

---

# 7. Practical Stop Rule for Engineering

Once MVP is complete:

- do not add new pipeline stages
- do not redesign the core architecture
- do not reopen backend contracts without a strong reason
- do not expand scope before analyst usage has validated the current system

Instead, switch focus to:
- adoption
- UX refinement
- reliability improvements
- better data quality
- selective phase 2 features

---

# 8. Immediate Recommendation

The final work needed before declaring Deep Research complete should be limited to:

1. analyst workbench UI
2. full edit → recompute workflows
3. real-company internal acceptance testing

Once those are complete, stop core Deep Research development.

---

# 9. Final Hard Stop

## Deep Research is finished when:

- the backend pipeline is reliable enough for internal usage
- the frontend exposes run/report/verification/edit/recompute flows
- analysts can use it independently
- report versions remain safe and understandable

At that point:

## Stop building the core feature.
