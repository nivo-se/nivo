# Deep Research V2 — Release Validation Checklist

**Purpose:** Verify V2 on real and fixture-based company runs before release. Confirm report-quality signaling, degraded/valuation-skipped trustworthiness, and diagnostics sufficiency.

**Last updated:** 2026-03

---

## 1. Test commands

### Unit tests (no DB / Redis)

```bash
cd backend && python -m pytest tests/unit/test_report_quality_gate.py tests/unit/test_run_diagnostics.py -v
```

### Integration tests (no DB / Redis required; uses mocks)

```bash
cd backend && python -m pytest tests/integration/test_deep_research_phase7.py -v
```

Covers: report quality gate (including degraded + valuation-skipped), run diagnostics builder, validation-summary output.

### Validation summary API (manual smoke)

```bash
# Replace RUN_ID and API_BASE with real values
curl -s "${API_BASE}/api/deep-research/analysis/runs/${RUN_ID}/validation-summary" | jq .
```

---

## 2. Real-company smoke test checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start a new Deep Research run for a company with **strong data** (e.g. known orgnr, website, financials) | Run enqueues; status moves from pending → running → completed |
| 2 | Check run status during execution | Stage rail advances; no indefinite hang on a single stage |
| 3 | On completion, open Run Status page | Report quality badge shows (Complete or Complete with limitations) |
| 4 | Open View Report | Report sections render; executive summary, financials, valuation (if applicable) present |
| 5 | Expand "Validation summary" (if visible) | Diagnostics show stage durations, evidence counts, assumption/valuation readiness |
| 6 | Start a run for a **weak-data company** (minimal financials, no website) | Run completes or fails with a clear stage; if completed, report shows "Complete with limitations" or degraded banner |
| 7 | Trigger a **valuation-skip** run (company that yields valuation_not_ready) | Valuation stage shows "Skipped"; report omits valuation figures; limitation summary explains |
| 8 | Rerun a previously failed run via Restart | Run re-queues; clears prior state; executes from identity |
| 9 | Call `GET /runs/{run_id}/validation-summary` for a completed run | JSON returns report_quality_status, assumption_valuation_ready, valuation_skipped, degraded_reasons |

---

## 3. Go / no-go criteria

**Go** when all of the following hold:

- [ ] Unit tests pass
- [ ] At least one strong-data run completes end-to-end
- [ ] Report quality badge reflects actual state (complete vs limited)
- [ ] Degraded reports show limitation summary; no misleading "complete" badge
- [ ] Valuation-skipped runs show skipped state in UI and report; no crash
- [ ] Rerun (Restart) works for failed runs
- [ ] Validation-summary endpoint returns expected fields for completed runs
- [ ] Debug endpoint (`/runs/{run_id}/debug`) returns run_diagnostics when available

**No-go** if:

- Report quality badge contradicts report content
- Valuation-skipped runs crash or hide the skip
- Rerun corrupts state or duplicates data
- Diagnostics are missing or empty for completed runs
- Repeated runs show inconsistent behavior (e.g. first succeeds, second fails with same input)

---

## 4. Common failure patterns to inspect

| Pattern | Where to look | Remediation |
|---------|---------------|-------------|
| Run stuck on `pending` | Redis, RQ worker status | Ensure worker running: `./scripts/start-deep-research-worker.sh` |
| Run stuck on `running` at a stage | LangGraph logs, RunNodeState output_json | Check stage validator; inspect error_message for failed node |
| Report shows "Complete" but sections empty | Report composer, report_quality_gate | Verify sections list; check quality gate reason_codes |
| Valuation shows figures when skipped | Valuation node output, report composer | Ensure valuation_skipped propagates to report metadata |
| Diagnostics empty on completed run | finalize_run, build_run_diagnostics | Ensure run_diagnostics passed to finalize_run on success |
| Rerun reuses stale data | restart endpoint, clear_run_analysis_data | Verify node states cleared before rerun |
| Stage durations missing | RunNodeState started_at/completed_at | Check node wrapper sets timestamps on completion |
| Evidence count 0 despite web retrieval | evidence_validation output, web_retrieval | Inspect evidence_validation node output_json |
| Assumption valuation_ready mismatch | assumption_registry output | Check blocked_reasons; verify promotion rules |

---

## 5. Validation summary fields (reference)

The `GET /analysis/runs/{run_id}/validation-summary` response includes:

| Field | Description |
|-------|-------------|
| `report_quality_status` | complete \| complete_with_limitations \| blocked \| failed |
| `report_quality_reason_codes` | Machine-readable codes (e.g. valuation_skipped, degraded) |
| `report_quality_limitation_summary` | Human-readable limitation text |
| `assumption_valuation_ready` | Whether assumption registry passed valuation gate |
| `assumption_blocked_reasons` | Reasons when not valuation-ready |
| `valuation_skipped` | Whether valuation stage was skipped |
| `valuation_readiness` | Inverse of valuation_skipped |
| `report_degraded` | Whether report was generated with known gaps |
| `report_degraded_reasons` | Stage failures or missing data reasons |
| `evidence_accepted_count` | Count of accepted evidence items |
| `evidence_rejected_count` | Count of rejected evidence items |
| `stage_durations` | Map of stage name → duration (seconds) |
| `failure_reason_codes` | Codes for failed stages |
