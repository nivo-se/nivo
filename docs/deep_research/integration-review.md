# Deep Research Integration Review

Date: 2026-03-07  
Author: Principal Engineering Review

## Scope

Inspected and integrated the following modules:

- `backend/api`
- `backend/agents`
- `backend/retrieval`
- `backend/orchestrator`
- `backend/verification`
- `backend/report_engine`

## Integration Work Completed

### 1) Orchestrator integration

- Replaced verification/report-generation node stubs with real module wiring:
  - `VerificationPipeline` now runs against persisted claims.
  - `ReportComposer` now composes multi-section report content from node outputs.
- `report_generation` now persists structured sectioned reports and returns `report_version_id` + `version_number`.

### 2) Persistence integration

- Added claim verification support in repository:
  - list claims for run/company
  - apply verification updates to `claims.is_verified`
- Fixed report versioning for reruns/regeneration:
  - `persist_report()` now increments `version_number` instead of hardcoding `1`.

### 3) API integration

- Replaced deep-research API stubs with DB-backed handlers:
  - `reports` routes now generate and retrieve persisted report versions/sections.
  - `verification` routes now execute pipeline verification and return run verification state.
  - `competitors` routes now return persisted competitors from latest run.
- Extended API models for consistency:
  - Added report section/detail response shapes.
  - Added competitor website field.
  - Added verification stats payload.

### 4) Verification and report modules

- `backend/verification/pipeline.py` now performs deterministic checks:
  - evidence coverage
  - confidence threshold (normal/strict)
  - verification status and issue list
- `backend/report_engine/composer.py` now builds a sectioned markdown report from node outputs:
  - executive summary
  - identity/profile
  - market/competition
  - strategy/value creation
  - financials/valuation

## Consistency Check

### Database models ↔ API models

- `report_versions` + `report_sections` now map to `ReportDetailData` + `ReportSectionData`.
- `competitors` now map to API payload including `website` and `relation_score`.
- Verification has no dedicated table; verification state is returned from orchestrator node state + claim flags.

### Database models ↔ agent outputs

- Agent outputs persist into:
  - `company_profiles`, `market_analysis`
  - `competitors`, `competitor_profiles`
  - `strategy`, `value_creation`
  - `financial_models`, `valuations`
  - `claims` with evidence/source chunk linkage
- JSON list outputs are normalized before persistence where DB columns are JSON objects.

### Agent outputs ↔ report structures

- `ReportComposer` now consumes orchestrator `node_results` across all major nodes.
- Financial section includes 7-year projection summary and valuation range.
- Verification section is reflected in executive status metadata.

## End-to-End Pipeline Validation

Validated API-level flow:

1. `POST /api/deep-research/sources/search-company`
2. `POST /api/deep-research/analysis/start`
3. `GET /api/deep-research/reports/company/{company_id}/latest`

Observed:

- analysis completed successfully
- report generated and persisted
- latest report returned with **5 sections**
- verification status retrievable

Also validated:

- deterministic financial outputs (`financial_deterministic=True`, `valuation_deterministic=True`)
- report regeneration creates new versions (`version_number` increments: 1 → 2 → 3)

## Remaining Issues

1. **Recompute routes remain stubbed**
   - `recompute/section` and `recompute/report` are queue placeholders only.
2. **Competitor compute endpoint is read-oriented**
   - `POST /competitors/compute` currently returns latest persisted results; it does not trigger a fresh compute job.
3. **Verification persistence model is indirect**
   - No dedicated verification run table; state is inferred from node output + claim flags.
4. **Synchronous orchestration in API**
   - `analysis/start` executes full pipeline inline (request/response), which will not scale for long-running jobs.
5. **Retrieval robustness**
   - SSL/network failures are handled and recorded, but source quality may be low when fetch/extract fails.

## Technical Debt

- Naming/docstrings still include historical “scaffold/stub” terminology in some files.
- Orchestrator currently mixes pipeline coordination and persistence-heavy logic in one module.
- Limited contract tests for cross-module invariants (agent output schema → DB schema → API response schema).
- No explicit schema migration path for future verification/report enrichment entities.

## Missing Components

- Background job orchestration for long-running analysis/recompute.
- Dedicated verification audit entities (run metadata, per-claim rule outcomes, reviewer overrides).
- Rich report rendering layer (HTML/PDF, citation footnotes, source traceability per sentence).
- Recompute engine that supports section-level incremental refresh.
- API auth/rate-limiting hardening specific to deep-research endpoints.

## Recommended Improvements (Priority Ordered)

### P0

1. Implement async job execution for analysis and recompute.
2. Add contract tests for:
   - orchestrator node outputs
   - persistence mappings
   - API response schemas
3. Add dedicated verification persistence model for auditability.

### P1

4. Implement recompute endpoints backed by real orchestration paths.
5. Add citations index in report sections (claim IDs → source chunks) for transparent traceability.
6. Add idempotency guards for repeated competitor/claim writes in resumed runs.

### P2

7. Introduce report templating/versioning strategy (template IDs, semantic section contracts).
8. Improve retrieval confidence scoring and source-quality filters before downstream analysis.

## Definition of Done Status

**Met for integration objective:** the platform now runs an end-to-end Deep Research pipeline  
`company → research → analysis → report`  
with persisted outputs and DB-backed API retrieval.
