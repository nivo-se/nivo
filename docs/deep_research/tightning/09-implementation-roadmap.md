# 09. Implementation Roadmap

## Goal

Ship the upgraded research-to-valuation architecture in a tight, sequenced way without destabilizing the existing deep research system.

## Guiding principle

Do one structural refactor, not ten separate feature branches:
- introduce canonical artifacts
- preserve current progress
- centralize validation
- keep valuation deterministic

## Phase 0: Stabilize current baseline

### Outcomes
- current workstreams compile and run
- existing stage validators still work
- persistence contracts are understood
- deep research UX MVP direction is agreed

### Deliverables
- baseline architecture inventory
- current module map
- known blockers list

## Phase 1: Introduce canonical documents and schemas

### Build
- `report_spec`
- `valuation_policy`
- `comp_policy`
- `evidence_policy`
- `uncertainty_policy`
- typed `EvidenceItem`
- typed `AssumptionItem`

### Files
- new schema modules
- policy config files
- report spec builder skeleton

### Exit criteria
- a report run can produce and persist `report_spec`
- policy versions are attached to run context

## Phase 2: Upgrade query planning into policy-aware compilation

### Build
- metric-driven query plan generation
- bilingual search support where relevant
- source-type targeting
- retrieval observability

### Exit criteria
- queries are traceable back to required metrics
- logs show query-to-metric mapping

## Phase 3: Formalize evidence pipeline

### Build
- source normalization
- evidence extraction
- evidence scoring
- conflict resolution
- validated evidence bundle persistence

### Exit criteria
- evidence bundle exists as a canonical persisted object
- accepted/rejected evidence is visible
- evidence coverage can be measured

## Phase 4: Add assumption registry

### Build
- assumption registry builder
- promotion rules
- interval construction
- valuation readiness checks

### Exit criteria
- valuation-ready and non-ready runs can be distinguished deterministically
- assumptions persist with evidence refs

## Phase 5: Build deterministic valuation spine

### Build
- DCF engine
- comps engine
- model checks
- scenario generation

### Exit criteria
- valuation outputs are generated from registry only
- model checks are persisted
- LLM is out of the math path

## Phase 6: Final report assembly and UX integration

### Build
- report section generation
- citations index
- confidence summary
- run workspace UI integration

### Exit criteria
- a user can launch, monitor, and review a report
- blocked states are understandable
- valuation is skipped gracefully when not ready

## Recommended workstream mapping

### Existing workstream 1
Keep and extend into:
- stronger company profile
- spec seeding fields

### Existing workstream 2
Refactor into:
- web intelligence + evidence bundle

### Existing workstream 3
Keep as:
- market + competitor synthesis
but ensure inputs come only from validated evidence

### New workstream 4
Build:
- assumption registry

### New workstream 5
Build:
- deterministic valuation engine

### New workstream 6
Build:
- final report assembly + UX integration

## Suggested implementation order by repository area

1. schemas and config
2. report spec builder
3. query compiler
4. evidence services
5. assumption registry
6. valuation services
7. orchestrator and validators
8. frontend UX
9. monitoring/debug views

## Tight scope rules

Do not build yet:
- analyst freeform model editing
- giant industry ontology
- self-tuning policy engine
- Monte Carlo valuation
- full manual evidence review console

## Success metrics

### Research quality
- parameter coverage rate
- evidence quality score
- conflict resolution rate

### Valuation consistency
- model check pass rate
- scenario sanity pass rate
- peer uniformity pass rate

### Workflow quality
- blocked run explainability
- rerun success rate
- median report completion time

## First implementation ticket bundle

1. Add `report_spec` schema + persistence
2. Add policy file loading
3. Add metric-driven query compiler
4. Add validated evidence bundle
5. Add assumption registry builder
6. Add valuation-ready gate
7. Add deterministic DCF skeleton
8. Add deep research run workspace MVP
