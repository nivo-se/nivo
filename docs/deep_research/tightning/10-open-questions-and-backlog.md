# 10. Open Questions and Backlog

## Immediate open questions

### 1. Source providers
- Will Tavily be the only search layer in v1?
- Do we add Firecrawl/PDF parsing in the same milestone or next?
- Which domains should be explicitly prioritized or deprioritized?

### 2. Policy defaults
- What should the default terminal growth hard cap be?
- What minimum evidence thresholds are acceptable per report mode?
- When are proxy assumptions allowed?

### 3. Valuation scope
- Is DCF mandatory in Standard mode?
- When should comps-only valuation be allowed?
- What is the minimum peer count by sector?

### 4. Assumption families
- Which assumptions are strictly required for valuation v1?
- Which can be inferred from historical financials?
- Which must always come from external evidence?

### 5. UX controls
- Which advanced settings belong in MVP?
- Which should remain org-level defaults only?
- How much debug visibility should end users see?

### 6. Persistence and storage
- What retention rules apply to raw search sessions?
- Should raw extraction excerpts be cached long-term?
- Do we version final reports separately from runs?

### 7. Privacy and governance
- Which data types must never be sent to external search providers?
- Do we need a lightweight DPIA assessment before broader rollout?
- What logging redaction is required?

## Recommended backlog themes

### A. Architecture and schemas
- create typed schema package
- add example payloads
- add JSON schema validation
- add migration plan for existing persistence

### B. Retrieval intelligence
- metric template library
- bilingual query template library
- source-type routing
- PDF table extraction improvements

### C. Evidence quality
- conflict clustering
- evidence score calibration
- source reputation registry
- scope mismatch detection

### D. Assumption system
- proxy assumption rules
- scenario interval builder
- manual override design
- confidence calibration

### E. Valuation engine
- comps normalization
- scenario explanation
- sensitivity tables
- audit logs

### F. UX and operations
- run queue view
- rerun actions
- report diffing
- blocked-state action cards

## Suggested ADRs to write later

- ADR-001: Research-to-valuation canonical artifact model
- ADR-002: Deterministic valuation boundary
- ADR-003: Policy versioning strategy
- ADR-004: Retrieval provider abstraction
- ADR-005: Evidence retention and privacy controls
