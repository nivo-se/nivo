# Stage Gating and Quality Thresholds

This document defines the quality thresholds, per-stage validation logic, and pipeline integrity checks used in the Deep Research pipeline.

---

## Quality Thresholds Configuration

Defined in `backend/services/deep_research/input_completeness.py`:

```python
DEEP_RESEARCH_THRESHOLDS = {
    "min_financial_years": 3,
    "min_competitors": 1,
    "require_real_orgnr": True,
    "require_starting_revenue": True,
    "require_market_label": True,
    "require_business_model": True,
}
```

These thresholds are referenced by both the `InputCompletenessValidator` and the per-stage validators.

---

## Core Pattern: Generate -> Validate -> Refine -> Approve

Every pipeline stage follows this pattern:

1. **Generate** — The agent/compute function produces output
2. **Validate** — A per-stage validator checks the output against quality criteria
3. **Refine** — If validation fails and retries remain, the stage is re-run
4. **Approve** — If validation passes, output flows to the next stage

If validation fails after all retries (`MAX_STAGE_RETRIES = 2`), the stage is marked as degraded but the pipeline continues. The degradation is recorded and surfaced in the report.

When `STRICT_STAGE_GATING=true` (environment variable), a failed validation after max retries raises `StageValidationError` instead of marking degraded. This is off by default.

---

## Per-Stage Validators

Defined in `backend/orchestrator/stage_validators.py`:

| Stage | Validator | Critical Checks |
|-------|-----------|----------------|
| `identity` | `validate_identity()` | orgnr exists, orgnr not `tmp-`, canonical_name present |
| `company_profile` | `validate_company_profile()` | summary present, business_model present |
| `market_analysis` | `validate_market_analysis()` | market label/size present, growth rate determined |
| `competitor_discovery` | `validate_competitors()` | competitor count >= threshold |
| `financial_model` | `validate_financial_model()` | assumption_set present, forecast present |
| `report_generation` | `validate_report_quality()` | report has sections, executive_summary not empty |

Stages without a validator (strategy, value_creation, valuation, verification) pass through with `status="pass"`.

---

## StageValidation Result

Each validator returns:

```python
@dataclass
class StageValidation:
    status: str    # "pass" | "warn" | "fail"
    issues: list[str]
    score: int     # 0-100
```

- `pass` — output is good, flows downstream
- `warn` — output has minor issues but is usable
- `fail` — output has critical issues, triggers retry or degradation

---

## Stage Result Tracking

Each stage produces a `stage_result` stored in `state["stage_evaluations"]`:

```python
{
    "stage": "identity",
    "status": "pass",
    "issues": [],
    "score": 100,
    "retry_count": 0,
    "elapsed_ms": 120,
}
```

These are persisted in the debug artifact for observability.

---

## Pipeline Integrity Check

Before report generation, `_evaluate_pipeline_integrity(state)` examines all stage evaluations:

1. Collects all stages with `status == "fail"`
2. If any failed stages exist:
   - Logs a warning
   - Sets `report_degraded = True`
   - Records `report_degraded_reasons` (list of failed stage names)
3. The report composer receives the degradation flag and renders appropriate warning banners

---

## Input Completeness Validator

The `InputCompletenessValidator` (in `input_completeness.py`) runs during report generation and produces:

```python
{
    "completeness_score": 82,
    "stage_passed": True,
    "stage_score": 82,
    "section_completeness": {"company": True, "market": False, ...},
    "missing_fields": ["market.market_label"],
    "weak_fields": ["historical_financials (only 3 years)"],
    "blocking_issues": [],
    "warnings": ["only 3 financial years available"],
    "orgnr_is_real": True,
    "historical_financials_years": 4,
    "competitor_count": 3,
    ...
}
```

### Blocking Issues (prevent clean report)

- `orgnr` is missing or synthetic (`tmp-`)
- `canonical_name` is empty
- No historical financials loaded
- Revenue history is entirely null
- Financials skipped due to tmp-orgnr

### Warnings (non-blocking)

- Fewer financial years than threshold
- EBITDA data missing for all years
- Financial year sequence has gaps
- Business model not available
- Market label/size not available
- Starting revenue missing for model
- Fewer competitors than threshold

---

## Report Degradation Banners

When the pipeline is degraded, the report composer inserts:

1. **Executive summary banner:** "This report was generated with incomplete data. Issues: [stage names]."
2. **Financial section banner:** "Financial history incomplete — projections are less reliable."

These ensure analysts see data quality status directly in the report.
