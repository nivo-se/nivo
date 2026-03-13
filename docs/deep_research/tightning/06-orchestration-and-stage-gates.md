# 06. Orchestration and Stage Gates

## Purpose

This document defines how the workflow should run operationally.

It covers:
- stage order
- pass/fail conditions
- blocked state behavior
- rerun strategy
- persistence checkpoints

## Workflow state model

### Run statuses
- `draft`
- `queued`
- `running`
- `blocked`
- `failed`
- `complete`

### Stage statuses
- `queued`
- `running`
- `passed`
- `warning`
- `blocked`
- `failed`
- `skipped`

## Canonical stage order

1. company_resolution
2. financial_grounding
3. company_understanding
4. report_spec
5. query_compilation
6. web_intelligence
7. evidence_validation
8. competitor_intelligence
9. market_synthesis
10. assumption_registry
11. valuation
12. report_assembly

## Minimum checkpoint outputs

Each stage must persist:
- input summary
- output artifact
- status
- confidence or quality summary
- blocking reason if not passed

## Stage gate examples

### Company understanding gate
Pass if:
- business_model present
- company_description present
- market_niche present when required
- confidence above threshold

### Web intelligence gate
Pass if:
- minimum evidence items collected
- minimum average score met
- no unresolved critical conflicts

### Market synthesis gate
Pass if:
- market model completeness above threshold
- evidence-backed market growth signal exists when required

### Assumption registry gate
Pass if:
- all required assumptions for selected outputs are present
- confidence thresholds met
- missing assumptions are non-critical or stage is configured to skip valuation

### Valuation gate
Pass if:
- valuation-ready assumption set exists
- model checks pass
- scenarios produced successfully

## Blocked-state handling

A blocked run must never be opaque.

For each blocked stage, persist:
- stage name
- machine-readable blocker code
- human-readable blocker reason
- suggested remediation actions

Example:
```yaml
blocked_stage:
  stage: "assumption_registry"
  code: "missing_terminal_growth_proxy"
  reason: "No acceptable terminal growth proxy was found under the active policy."
  suggested_actions:
    - "broaden market evidence scope"
    - "allow proxy assumptions"
    - "skip valuation in this run"
```

## Retry strategy

### Safe automatic reruns
Allowed for:
- network timeouts
- transient retrieval issues
- parser failures
- idempotent extraction retries

### Manual reruns
Required for:
- policy changes
- analyst context changes
- company website override
- evidence strictness changes

## Partial rerun strategy

Allow reruns from these restart points:
- `company_understanding`
- `query_compilation`
- `web_intelligence`
- `assumption_registry`
- `valuation`

Do not rerun the whole pipeline if only valuation policy changed.

## Recommended orchestrator contract

Each stage node should expose:
- `prepare(context)`
- `run(context)`
- `validate(output, policy)`
- `persist(output)`
- `summarize(output)`

## Suggested implementation files

```text
backend/orchestrator/langgraph_orchestrator.py
backend/orchestrator/stage_validators.py
backend/orchestrator/persistence.py
backend/services/deep_research/debug_dump.py
```
