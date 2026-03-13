# Phase 7: Deep Research V2 Hardening and Release Readiness

**Goal:** Make the existing Deep Research V2 pipeline reliable, testable, and safe for internal use without expanding feature scope.

**Date:** 2026-03

---

## Scope Summary

| Area | Deliverables |
|------|--------------|
| End-to-end reliability | Integration tests for full run, valuation skipped, blocked assumption, degraded report, rerun, partial failure |
| Report quality gate | Final gate before marking complete; inspects degraded state, missing sections, evidence/assumption coverage, contradictions |
| Observability | Persist and expose stage durations, failure codes, evidence counts, assumption readiness, valuation readiness, report degraded |
| UX trust signals | Report-level status badge (Complete, Complete with limitations, Blocked, Failed); limitation summary block |
| Core contracts | Inline documentation for report_spec, evidence, assumption registry, valuation output, report metadata |
| QA fixtures | Fixture pack for strong-data, weak-data, valuation-skip, noisy-competitor archetypes |

---

## 1. Report Quality Gate

**Location:** `backend/services/deep_research/report_quality_gate.py`

The gate runs after report composition and before persisting the report. It inspects:

- `report_degraded` and `report_degraded_reasons`
- Missing or empty key sections (executive_summary, financials_and_valuation, etc.)
- Evidence coverage from evidence_validation / evidence_bundle
- Assumption coverage from assumption_registry
- Valuation skipped vs valuation output presence
- Contradictions between report metadata and stage outputs

**Output:** `ReportQualityResult` with:

- `status`: `complete` | `complete_with_limitations` | `blocked` | `failed`
- `reason_codes`: list of machine-readable codes (e.g. `valuation_skipped`, `weak_evidence`, `missing_section`)
- `limitation_summary`: human-readable summary for UI

**Persistence:** Stored in `ReportVersion.extra["quality_gate"]` and `AnalysisRun.extra["report_quality"]`.

---

## 2. Observability and Diagnostics

**Persisted fields (AnalysisRun.extra["diagnostics"]):**

- `stage_durations_ms`: map of node_name → duration
- `failure_reason_codes`: list for failed runs
- `evidence_accepted_count`, `evidence_rejected_count`
- `assumption_readiness`, `assumption_coverage_pct`
- `valuation_ready`, `valuation_skipped`
- `report_degraded`, `report_degraded_reasons`

**Exposure:** Included in `GET /analysis/runs/{run_id}/status` when `?debug=1` or when user is admin. Also exposed via `GET /analysis/runs/{run_id}/diagnostics` (admin-only).

---

## 3. UX Trust Signals

| Status | Badge | When |
|--------|-------|------|
| Complete | Green "Complete" | Quality gate pass, no limitations |
| Complete with limitations | Amber "Complete (with limitations)" | Degraded report, valuation skipped, or weak evidence |
| Blocked | Red "Blocked" | Run failed at a stage with suggested remediation |
| Failed | Red "Failed" | Run failed with no recovery path |

**Limitation summary block:** Shown below the status badge when report is degraded. Lists reason codes and suggested next steps.

---

## 4. Core Contracts (Stabilized)

Documented and frozen interfaces:

- `backend/models/v2/report_spec.py` — ReportSpec, PolicyVersions, RequiredMetric
- `backend/models/v2/evidence.py` — EvidenceItem, ValidatedEvidenceBundle
- `backend/models/v2/assumption.py` — AssumptionItem, AssumptionRegistry, AssumptionRegistryReadiness
- Valuation output shape — enterprise_value_msek, equity_value_msek, valuation_range_*, skipped, blocked_reasons
- Report metadata — report_degraded, report_degraded_reasons, validation_status

---

## 5. QA Fixtures

**Location:** `backend/tests/fixtures/deep_research/`

Fixtures for integration tests:

- `strong_data_company.json` — Full financials, website, market data
- `weak_data_company.json` — Minimal financials, no website
- `valuation_skip_company.json` — Triggers assumption_registry not ready
- `noisy_competitor_company.json` — Many competitors, low confidence

---

## Tests

**Unit tests** (no DB required):

```bash
# From project root, with backend venv activated
cd backend && python -m pytest tests/unit/ -v
```

**Integration tests** (require Postgres, Redis; optional):

```bash
cd backend && python -m pytest tests/integration/ -v
```

---

## Constraints

- No new user-facing feature surfaces except trust/readability
- Prioritize reliability, consistency, and explainability
- Do not expand product scope
