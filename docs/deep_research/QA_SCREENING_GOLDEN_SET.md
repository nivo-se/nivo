# Screening cohort — golden set (Phase A exit gate)

## Purpose

Before scaling **LLM relevance (Phase B/C)**, the **SQL + exclusion cohort** should be good enough that obvious sector/structure mismatches are rare. This doc defines how to build and score a **golden set** of orgnrs.

## What to label

- **Pass:** fits Nivo thesis on **name + primary SNI/NACE + rough size** (would not waste analyst time).
- **Fail:** obvious **NO** (wrong sector, holding shell, etc.) visible without deep diligence.

Target **50–100** orgnrs sampled from recent universe matches (stratify by SNI prefix if possible).

## How to measure

- Run the cohort query (or export candidate orgnrs from a test campaign).
- Label each orgnr pass/fail.
- **Precision (fail-focused):** among labels, track **false pass rate** (passes that should be fail) — drive this down with **SQL exclusions** and profile rules, not LLM.

## Exit gate (team-defined)

**Agreed default threshold:** **≤15% false passes** (pass labels that should have been fail on obvious sector/structure NOs) on the golden set before prioritizing Layer 1 batch spend at scale.

Record the active threshold and review date below when the team changes it.

| Review date | Threshold | Notes |
|-------------|-----------|-------|
| 2026-03-23 | ≤15% false passes | Initial default per screening quality roadmap |

## References

- Roadmap: Cursor plan `screening_quality_roadmap` (screening quality).
- Exemplar mandate: [`screening_exemplars/screening_output.json`](screening_exemplars/screening_output.json).
