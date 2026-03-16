# Deep Research V2 — Internal Pilot Plan

**Purpose:** Controlled internal pilot to validate V2 before broader rollout. Support 10–20 runs, capture recurring weaknesses, and build release confidence.

**Last updated:** 2026-03

---

## 1. Pilot goals

1. **Validate end-to-end quality** — Confirm report quality signaling (complete vs limited vs blocked) matches actual report content.
2. **Identify recurring weaknesses** — Track which reason codes and failure patterns appear most often.
3. **Standardize reason-code usage** — Ensure all codes are used consistently (see [reason-code-taxonomy.md](./reason-code-taxonomy.md)).
4. **Confirm degraded/valuation-skipped trustworthiness** — Verify reports with limitations remain understandable and non-misleading.
5. **Stress diagnostics and admin visibility** — Ensure pilot reviewers can quickly inspect run status and triage issues.

---

## 2. Recommended company mix

Target **10–20 runs** across a mix of company profiles:

| Profile | Count | Description | Expected outcome |
|--------|-------|-------------|------------------|
| **Strong data** | 4–6 | Known orgnr, website, public financials | `complete`; full valuation |
| **Weak data** | 3–5 | Minimal financials, no website, niche company | `complete_with_limitations` or degraded |
| **Valuation-skip** | 2–3 | Company that yields `valuation_not_ready` | `complete_with_limitations`; valuation skipped |
| **Edge / noisy** | 2–3 | Multi-brand, subsidiary, unusual structure | May fail or degrade; useful for edge cases |

**Examples (adjust per portfolio):**

- Strong: Segers Fabriker, Texstar, other portfolio companies with solid public data
- Weak: Small private companies, early-stage startups
- Valuation-skip: Companies with missing terminal growth or WACC evidence
- Edge: Holding companies, subsidiaries with shared branding

---

## 3. Evaluation criteria

For each run, reviewers should assess:

| Criterion | Check |
|----------|-------|
| **Quality badge accuracy** | Does `report_quality_status` reflect report content? |
| **Limitation visibility** | Are `report_quality_limitation_summary` and reason codes visible and understandable? |
| **Degraded transparency** | If degraded, are `report_degraded_reasons` clearly surfaced? |
| **Valuation skip handling** | If valuation skipped, does report omit figures and explain why? |
| **Evidence quality** | Are evidence counts and assumption blockers traceable? |
| **Section completeness** | Are executive summary, financials, and valuation (when applicable) present? |

---

## 4. Issue triage format

When filing a pilot issue, use this format for consistency:

```
**Run ID:** <run_id>
**Company:** <company_name>
**Profile:** strong | weak | valuation-skip | edge
**Status:** completed | failed
**Report quality:** complete | complete_with_limitations | blocked
**Reason codes:** <comma-separated>
**Issue:** <brief description>
**Expected:** <what should have happened>
**Actual:** <what happened>
**Severity:** P0-blocker | P1-major | P2-minor | P3-documentation
```

Reference [reason-code-taxonomy.md](./reason-code-taxonomy.md) when describing reason codes.

---

## 5. Admin visibility for pilot review

| Surface | What it shows |
|---------|----------------|
| **Run list** (`/deep-research/runs`) | Admin expandable block: run_id, company, quality status, degraded reasons, valuation skipped, assumption blockers, evidence counts |
| **Run status** (`/deep-research/runs/:id`) | Full Validation summary (collapsible), Report quality badge |
| **Validation summary API** | `GET /api/deep-research/analysis/runs/:id/validation-summary` — compact JSON for scripts |
| **Logs** | `deep_research.pilot` logger emits run_complete events with pilot-relevant fields |

---

## 6. Exit criteria for broader rollout

**Go** when:

- [ ] All pilot runs (10–20) reviewed; no P0 blockers
- [ ] Report quality badge matches report content in >90% of cases
- [ ] Degraded and valuation-skipped reports are clearly signaled; no misleading "complete"
- [ ] Recurring reason codes documented; no unresolved taxonomy gaps
- [ ] Admin visibility sufficient for triage without debug spelunking
- [ ] At least 2 strong-data runs completed end-to-end with `complete` status

**No-go** if:

- Report quality contradicts report content in multiple cases
- Valuation-skipped or degraded runs crash or hide limitations
- Critical reason codes missing or ambiguous
- Admin cannot reliably inspect run state
- Rerun or restart behavior breaks pilot workflows

---

## 7. Constraints (no scope expansion)

- **No analyst editing workflows** — Pilot focuses on automated pipeline output.
- **No new research features** — Only operational clarity and pilot learning.
- **Avoid schema churn** — Keep reason codes and API stable during pilot.
