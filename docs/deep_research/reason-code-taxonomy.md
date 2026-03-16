# Deep Research V2 — Reason Code Taxonomy

**Purpose:** Standardize and document all report quality, degraded, valuation-skip, and assumption-blocker reason codes. Use for pilot evaluation, debugging, and consistent UI treatment.

**Last updated:** 2026-03

---

## 1. Report quality reason codes (`report_quality_reason_codes`)

Emitted by the report quality gate (`evaluate_report_quality`). Source: `report_generation` stage.

| Code | Meaning | Source stage | Blocking | UI treatment | Affects report_quality_status |
|------|---------|--------------|----------|--------------|-------------------------------|
| `empty_sections` | Report has no sections | report_generation | **Yes** | Blocked badge; no View Report | `blocked` |
| `blocked_assumption_registry` | Assumption registry not valuation-ready (missing keys, no bundle) | assumption_registry | **Yes** | Blocked badge; show assumption blockers | `blocked` |
| `missing_executive_summary` | Executive summary section missing | report_generation | No | Complete with limitations; show limitation | `complete_with_limitations` |
| `missing_financials` | No historical_financials or financials_and_valuation section | report_generation | No | Complete with limitations | `complete_with_limitations` |
| `missing_valuation` | Valuation section expected but missing (rare; usually valuation_skipped instead) | report_generation | No | Complete with limitations | `complete_with_limitations` |
| `valuation_skipped` | Valuation stage skipped (insufficient evidence/assumptions) | valuation | No | Amber badge; "Valuation skipped" banner; omit valuation figures | `complete_with_limitations` |
| `degraded` | One or more upstream stages failed; report generated with partial data | pipeline integrity | No | Complete with limitations; show degraded_reasons | `complete_with_limitations` |
| `insufficient_evidence` | Zero evidence items accepted; no web sources | evidence_validation, web_retrieval | No | Complete with limitations; "No evidence items accepted" | `complete_with_limitations` |
| `insufficient_assumptions` | Reserved (not currently emitted) | — | No | — | — |
| `metadata_mismatch` | Reserved (not currently emitted) | — | No | — | — |

**Blocking codes** force `report_quality_status = blocked` and `passed = False`. All others allow `complete_with_limitations`.

---

## 2. Degraded reasons (`report_degraded_reasons`)

Free-form strings describing *why* the report is degraded. Source: `_evaluate_pipeline_integrity` (failed stage names) and optionally web retrieval metadata.

### Pipeline integrity (stage failures)

| Value pattern | Meaning | Blocking | UI treatment |
|---------------|---------|----------|--------------|
| `company_profile` | Company profile stage failed validation | No | Show in limitation summary; degraded banner |
| `identity` | Identity resolution failed | No | Same |
| `web_retrieval` | Web retrieval stage failed or degraded | No | Same |
| `evidence_validation` | Evidence validation failed | No | Same |
| `market_analysis` | Market analysis stage failed | No | Same |
| `competitor_discovery` | Competitor discovery failed | No | Same |
| `assumption_registry` | Assumption registry build failed | No | Same |
| `valuation` | Valuation failed (not skipped) | No | Same |
| `financial_model` | Financial model failed | No | Same |

Values are stage names from `stage_evaluations` where `status == "fail"`.

### Web retrieval degraded_reason (from `web_retrieval` metadata)

| Code | Meaning | Source |
|------|---------|--------|
| `budget_exceeded_max_queries` | Hit max queries budget before evidence threshold | web_retrieval_service |
| `budget_exceeded_max_extracted_urls` | Hit max extracted URLs budget | web_retrieval_service |
| `insufficient_evidence_after_max_rounds` | Quality &lt; 0.7 after all supplemental rounds | web_retrieval_service |

These may appear in `bundle.metadata["degraded_reason"]` and can propagate to tracing; they are **not** automatically added to `report_degraded_reasons`. Pipeline integrity `report_degraded_reasons` are stage names only.

---

## 3. Assumption blocker reasons (`assumption_blocked_reasons`)

Emitted when `assumption_registry.valuation_ready == False`. Source: `assumption_registry` and `valuation` nodes.

| Value pattern | Meaning | Source stage | Blocking | UI treatment |
|---------------|---------|--------------|----------|--------------|
| `Missing: {key}` | Required metric key missing from assumption registry | assumption_registry | Yes (for valuation) | Show in Validation summary; assumption blockers |
| `No evidence bundle found` | No evidence bundle for run | assumption_registry | Yes | Same |
| `missing_terminal_growth` | Terminal growth proxy missing | valuation (skipped) | Yes | Same |
| `missing_terminal_growth_proxy` | Same as above | valuation output | Yes | Same |
| `insufficient_evidence_for_wacc` | WACC assumptions insufficient | valuation output | Yes | Same |
| `no terminal growth` | Human-readable variant | tests/fixtures | Yes | Same |

Blocked reasons flow to `run_diagnostics.assumption_blocked_reasons` and validation-summary API.

---

## 4. Valuation skip

| Field | Value | Meaning |
|-------|-------|---------|
| `valuation_skipped` | `true` | Valuation stage was skipped |
| `valuation.output.reason` | `valuation_not_ready` | Canonical skip reason |
| `valuation.output.blocked_reasons` | `string[]` | Reasons (e.g. missing_terminal_growth) |

When skipped, report omits valuation figures; limitation summary includes "Valuation was skipped (insufficient evidence or assumptions)".

---

## 5. Failure reason codes (`failure_reason_codes`)

Format: `{node_name}:{error_message_preview}` (e.g. `identity:Company not found`). Source: `build_run_diagnostics` from failed `RunNodeState` rows.

Used for debug/triage; not surfaced in report quality UI. Do not add new formats without updating this taxonomy.

---

## 6. Usage guidelines for pilot

1. **Standardize new codes:** Before adding a code, add it here with meaning, source, blocking, and UI treatment.
2. **Prefer existing codes:** Use `valuation_skipped`, `degraded`, `blocked_assumption_registry`, `insufficient_evidence` instead of ad-hoc strings where applicable.
3. **Avoid schema churn:** Keep codes stable during pilot; document new ones in a "Proposed" section if needed.
4. **Pilot triage:** When filing issues, reference the reason code and this doc for consistency.
