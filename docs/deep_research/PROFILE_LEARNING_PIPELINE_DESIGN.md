# Profile-Learning Pipeline: Technical Design

## Purpose

This document defines the **offline profile-learning workflow** that converts a batch of manually labeled Deep Research reports into Layer 1 screening profile inputs (variables, weights, archetypes, exclusion rules, and review prompts). The pipeline is **not** part of the live Layer 1 runtime; it is an intelligence-generation process run periodically by the team.

**Context:** Layer 1 already supports deterministic screening, saved views, screening profiles and versions, profile exclusions, profile-weighted score, archetype codes, and manual handoff to AI Lab. This design covers how to **produce** the screening profile config from ~20 externally produced, team-labeled Deep Research reports.

---

## 1. Input model

Each report is processed as an **input package**. The package is the unit of work for extraction and for batch comparison.

### 1.1 Report input package (per report)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `report_id` | string (UUID or slug) | Yes | Unique id for this report in the batch. |
| `report_file` | string (path or URL) | Yes | Path or reference to the report artifact. Format is out of scope (PDF, HTML export, or structured JSON if reports are ever exported from the app). |
| `company_identity` | object | Yes | Identifies the company the report is about. |
| `user_label` | enum | Yes | Team verdict: `strong` \| `maybe` \| `weak` \| `reject`. |
| `analyst_notes` | string | No | Free-text notes from the reviewer (e.g. "Margin trend concerning", "Perfect fit for buy-and-build"). |

### 1.2 Company identity (within package)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orgnr` | string | Preferred | Swedish org number when known; used to link to Universe. |
| `legal_name` | string | Yes | Company name as in the report. |
| `segment_or_industry` | string | No | Segment/industry from report or reviewer. |

**Note:** Reports are assumed to be external documents. If `orgnr` is missing, the package is still valid for extraction and comparison; linking to Layer 1 Universe (e.g. for variable calibration) may require a later resolution step.

### 1.3 Label semantics

- **strong** — Would advance to AI Lab / due diligence; use as positive training signal.
- **maybe** — Borderline; can contribute to both positive and negative traits.
- **weak** — Unlikely to pursue; use as weak negative or exclusion signal.
- **reject** — Clear no; use as strong negative and exclusion-signal source.

### 1.4 Batch input

A **batch** is a set of N report input packages (e.g. N ≈ 20). The batch is the input to the comparison workflow. Recommended representation: a single JSON array or a directory of per-report JSON files plus a manifest.

**Example manifest (batch level):**

```json
{
  "batch_id": "learning-batch-2025-Q1",
  "created_at": "2025-03-01T00:00:00Z",
  "reports": [
    {
      "report_id": "report-001",
      "report_file": "reports/company_a_deep_research.pdf",
      "company_identity": {
        "orgnr": "556xxx-xxxx",
        "legal_name": "Example AB",
        "segment_or_industry": "B2B software"
      },
      "user_label": "strong",
      "analyst_notes": "Clear platform play, fragmented niche."
    }
  ]
}
```

---

## 2. Extraction schema

For each report, we define a **canonical extraction schema** that captures structured learnings. This is the output of the “per-report extraction” step and the input to the batch comparison step. All fields are optional at capture time; the comparison step will aggregate and decide what becomes profile config.

### 2.1 Design principles

- One schema per report; same shape for all labels (strong / maybe / weak / reject).
- Traits are **normalized** where possible (e.g. numeric ranges, controlled vocabularies) so that comparison is meaningful across reports.
- Free-text fields are allowed for context but the pipeline should favor structured fields for automation.
- Each section can include a confidence or source hint (e.g. `"inferred_from": "narrative"`) for later refinement.

### 2.2 Top-level extraction document (per report)

```yaml
report_id: string
company_identity: { orgnr?, legal_name, segment_or_industry? }
user_label: strong | maybe | weak | reject
analyst_notes: string?

# --- Structured extractions (all optional) ---

financial_traits:
  revenue_range_sek: [min, max] | null      # e.g. [50e6, 200e6]
  ebitda_margin_range: [min, max] | null    # e.g. [0.08, 0.15]
  revenue_cagr_range: [min, max] | null    # e.g. [0.05, 0.20]
  growth_trajectory: stable | improving | declining | volatile
  margin_trajectory: stable | improving | declining | volatile
  leverage_note: low | moderate | high | unknown
  raw_metrics: {}                           # key-value for any numeric the report mentions

business_traits:
  business_model: string[]                  # e.g. ["B2B", "recurring revenue", "platform"]
  customer_concentration: low | moderate | high | unknown
  geography: string[]                       # e.g. ["Nordics", "EU"]
  product_scope: string[]                   # e.g. ["SaaS", "services"]
  fragmentation_signal: boolean?            # true if market described as fragmented

market_traits:
  market_size_mention: string?              # free text or structured later
  market_cagr_mention: string?
  structural_trends: string[]               # e.g. ["digitalization", "consolidation"]
  niche_attractiveness: high | medium | low | unknown

operational_value_levers:
  levers: string[]                          # e.g. ["buy-and-build", "D2C shift", "internationalization"]
  ops_upside: high | medium | low | unknown
  professionalization_potential: boolean?

risk_rejection_signals:
  deal_breakers: string[]                   # e.g. ["customer concentration", "regulatory risk"]
  risk_flags: string[]                      # e.g. ["margin pressure", "key person"]
  rejection_reasons: string[]               # from narrative or analyst_notes when label = reject/weak

archetype_hints:
  suggested_codes: string[]                 # e.g. ["growth_platform", "margin_turnaround"]
  criteria_hints: {}                         # field -> { gte?, lte?, between? } from narrative
  narrative_tags: string[]                   # free-form tags for clustering

exclusion_hints:
  suggested_exclusions: []                  # list of { field, op, value } candidates
  rationale: string?                         # why these exclusions (e.g. "reject set had margin < 5%")
```

### 2.3 Mapping extraction fields to Layer 1 concepts

| Extraction area | Feeds into Layer 1 |
|-----------------|---------------------|
| `financial_traits` | Variables (e.g. revenue_latest, ebitda_margin_latest, revenue_cagr_3y), weights, exclusion_rules (e.g. margin < x). |
| `business_traits` | Archetype criteria (e.g. segment, size), exclusion hints. |
| `market_traits` | Archetype hints, optional future variables if Layer 1 gains market fields. |
| `operational_value_levers` | Weights (emphasize growth/margin), archetype definitions. |
| `risk_rejection_signals` | exclusion_rules, deal-breaker thresholds. |
| `archetype_hints` | `archetypes[].code`, `archetypes[].criteria`. |
| `exclusion_hints` | `exclusion_rules[]` after validation against allowed fields. |

### 2.4 Layer 1–allowed exclusion fields (reference)

The following fields are supported for profile `exclusion_rules` in Layer 1 (see `backend/api/universe.py`): `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, `employees_latest`, `data_quality_score`, `fit_score`, `ops_upside_score`, `nivo_total_score`, `research_feasibility_score`. Extraction and comparison should only output exclusion candidates that use these fields (or be mapped to them).

---

## 3. Batch comparison workflow

The comparison step takes N extraction documents (one per report) and produces a single **comparison result** that will later be turned into a profile version.

### 3.1 Inputs

- List of extraction documents (one per report in the batch).
- Optional: configurable thresholds (e.g. minimum count for “common” trait, minimum support for an exclusion rule).

### 3.2 Steps

1. **Stratify by label**
   - Split reports into: strong, maybe, weak, reject.
   - Counts and proportions are recorded for the output (e.g. 8 strong, 5 maybe, 4 weak, 3 reject).

2. **Common positive traits**
   - Across **strong** (and optionally **maybe**) reports: aggregate `financial_traits`, `business_traits`, `market_traits`, `operational_value_levers`.
   - For numeric ranges: compute intersection or a consensus range (e.g. revenue_range_sek: take overlap or median of ranges).
   - For enums/lists: count frequency; output traits that appear in ≥ K reports (e.g. K = 50% of strong).
   - Output: list of “positive traits” with support count and suggested variable/weight implications.

3. **Common negative traits**
   - Across **weak** and **reject** reports: aggregate `risk_rejection_signals`, `financial_traits` (e.g. low margin, declining), `exclusion_hints`.
   - Same logic: frequency counts, consensus ranges.
   - Output: list of “negative traits” and suggested exclusion or anti-weights.

4. **Repeated exclusion signals**
   - Collect all `exclusion_hints.suggested_exclusions` from weak/reject (and maybe) reports.
   - Normalize to Layer 1 field names and allowed ops (`=`, `>=`, `<=`, `between`).
   - Merge equivalent rules (e.g. “ebitda_margin_latest < 0.05” appearing in 3 reports).
   - Output: candidate exclusion rules with support count and optional rationale.

5. **Candidate archetypes**
   - Collect `archetype_hints` from all reports; cluster by `suggested_codes` and `criteria_hints`.
   - For each recurring code or pattern: propose one archetype with `code` and `criteria` (criteria using Layer 1 fields: e.g. `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, `segment_tier`).
   - Ensure criteria use only fields available in the Universe query (see `_match_archetype_criteria` in universe.py: numeric fields with `gte`/`lte`/`between`, and for `segment_tier`/`name` string comparison).
   - Output: list of candidate archetypes with support count and suggested criteria.

6. **Variable and weight suggestions**
   - From common positive/negative traits and existing Layer 1 variable set, suggest:
     - **Variables:** which Universe fields to include (id, source, normalize, range) and suggested ranges from consensus.
     - **Weights:** relative importance (e.g. growth 0.35, margin 0.35, size 0.20, data_quality 0.10).
   - Output: candidate `variables` and `weights` for the profile config.

### 3.3 Output of comparison (intermediate)

The comparison step produces a **comparison result** document (see Section 4) that is still **not** a live profile. It is the input to the human review step and then to the profile-generation mapping.

---

## 4. Output schema (comparison result)

The comparison workflow emits a single structured document that can be versioned, reviewed, and then mapped to Layer 1.

### 4.1 Comparison result (full shape)

```yaml
batch_id: string
created_at: string (ISO datetime)
report_count: int
label_counts: { strong: int, maybe: int, weak: int, reject: int }

common_positive_traits:
  financial: []    # e.g. { trait: "revenue_range", range: [50e6, 300e6], support: 7 }
  business: []
  market: []
  operational_levers: []

common_negative_traits:
  financial: []
  risk_signals: []
  rejection_themes: []

candidate_exclusion_rules:
  - field: string    # Layer 1 field name
    op: string       # =, >=, <=, between
    value: number | [number, number]
    support_count: int
    rationale: string?

candidate_archetypes:
  - code: string
    criteria: {}     # field -> { gte?, lte?, between?, eq? }
    support_count: int
    description: string?

candidate_variables:
  - id: string
    source: string   # Universe row field
    normalize: "min_max" | "linear"
    range: [number, number]?
    support_note: string?

candidate_weights:
  # var_id -> weight (float); need not sum to 1 (normalization can be applied at mapping time)
  id1: float
  id2: float

review_prompts: []   # see Section 5
```

### 4.2 Review prompts (in comparison result)

`review_prompts` is a list of short, analyst-facing prompts to be used when a company is handed off to AI Lab or when a human re-screens. Each item can be:

```yaml
- id: string
  label: string       # e.g. "Strong fit"
  prompt_text: string # e.g. "Assess buy-and-build potential and margin sustainability."
  when_archetype: string?  # optional: show when this archetype_code is set
  when_score_band: string? # optional: e.g. "high" when profile_weighted_score in top quartile
```

These are **outputs** of the learning pipeline (e.g. derived from common positive traits and archetypes) and can be stored in the profile config or in a separate store; the exact storage is left to implementation. Layer 1 today does not persist “review prompts” in `config_json`; this design defines them so a future backend/UI can consume them.

---

## 5. Human review step

Before the comparison result becomes a **live** screening profile version, analysts must review and edit.

### 5.1 Review inputs

- **Comparison result** (Section 4).
- Optional: side-by-side view of source extractions or report snippets for key traits.

### 5.2 Review actions

1. **Approve or edit candidate exclusion rules**
   - Remove false positives; add missing exclusions; adjust thresholds (value) or field/op.
   - Only Layer 1–allowed fields and ops may be used.

2. **Approve or edit candidate archetypes**
   - Merge or split archetypes; adjust `code` and `criteria` so they match intended segments (e.g. “growth_platform”: revenue_cagr_3y >= 0.10, ebitda_margin_latest >= 0.08).

3. **Approve or edit variables and weights**
   - Ensure `variables[].source` are valid Universe row fields used by `_compute_profile_weighted_score` (e.g. revenue_latest, ebitda_margin_latest, revenue_cagr_3y).
   - Tune weights so they reflect team priorities.

4. **Edit or add review prompts**
   - Assign prompts to archetypes or score bands so that handoff to AI Lab is consistent.

5. **Sign-off**
   - Mark the comparison result as “approved for profile generation” (workflow state; can be a flag or a separate “approved” artifact).

### 5.3 Output of review

- **Approved comparison result**: the same schema as Section 4, with edits applied. This is the input to the profile-generation mapping (Section 6).

---

## 6. Profile generation mapping

Map the **approved comparison result** into the existing screening profile config schema used by Layer 1.

### 6.1 Target: `config_json` in `screening_profile_versions`

Layer 1 expects `config_json` with:

- `variables`: array of variable objects (id, source, normalize, range).
- `weights`: object mapping variable `id` to numeric weight.
- `archetypes`: array of { code, criteria } (criteria: field -> { gte, lte, between, eq }).
- `exclusion_rules`: array of { field, op, value }.

Optional (for future use):

- `review_prompts`: array of { id, label, prompt_text, when_archetype?, when_score_band? }; storage TBD.

### 6.2 Mapping rules

| Comparison result block | → config_json |
|-------------------------|----------------|
| `candidate_variables` (approved) | `config_json.variables` — use as-is; ensure `source` is a valid Universe field. |
| `candidate_weights` (approved) | `config_json.weights` — key = variable `id`, value = number. Optionally normalize so weights sum to 1. |
| `candidate_archetypes` (approved) | `config_json.archetypes` — each item → { code, criteria }; drop `support_count` and `description` for runtime. |
| `candidate_exclusion_rules` (approved) | `config_json.exclusion_rules` — each item → { field, op, value }; `field` must be in `_EXCLUSION_FIELD_TYPES`; `value` type must match (number vs percent). |
| `review_prompts` (approved) | Store in config or separate table; not required by current Layer 1 runtime. |

### 6.3 Validation before write

- Every `variables[].source` must exist in the Universe query row (or be ignored by the backend).
- Every `weights` key must match a `variables[].id`.
- Every `exclusion_rules[].field` must be in the allowed exclusion field list.
- Archetype `criteria` keys must be fields the backend can read from the row (numeric: gte/lte/between; segment_tier/name: eq/gte/lte as per `_match_archetype_criteria`).

### 6.4 Creating the profile version

- Create or select the target **screening profile** (e.g. “Nivo Q1 2025 learned profile”).
- Create a new **screening_profile_version** with:
  - `version`: next version number.
  - `config_json`: the mapped object above.
  - `is_active`: false until the team activates it.
- Optionally set the new version as active after validation.

---

## 7. Recommended implementation format

Recommendation: **combination of structured files plus small scripts**, with an optional admin UI later.

| Component | Format | Rationale |
|-----------|--------|-----------|
| **Input model** | JSON (manifest + per-report packages) | Simple, toolable, versionable in git or asset store. |
| **Extraction schema** | JSON Schema or YAML schema in repo | Single source of truth; validators and generators can use it. |
| **Per-report extraction** | JSON files (one per report) | Enables incremental runs and diff-friendly storage. |
| **Batch comparison** | Script (Python/Node) that reads extractions and writes comparison result | Repeatable; can be run locally or in CI. |
| **Comparison result** | JSON or YAML file | Easy to diff and review in PRs. |
| **Human review** | Markdown checklist + edit of the comparison result file, or simple admin UI | MVP: edit JSON/YAML by hand or via a minimal UI; later: dedicated “profile learning” UI. |
| **Profile generation** | Script or API call | Script: read approved result, call backend API to create profile version. |
| **Review prompts** | In comparison result; later in DB or config | Start as part of comparison result; add persistence when AI Lab handoff uses them. |

### 7.1 Suggested repo layout (optional)

```text
docs/deep_research/profile_learning/
  PROFILE_LEARNING_PIPELINE_DESIGN.md   # this doc
  extraction_schema.json                 # canonical extraction schema
  example_batch_manifest.json
  example_extraction.json
  example_comparison_result.json

profile_learning/                       # optional package
  extract.py                             # single-report extraction (manual or tool-assisted)
  compare.py                             # batch comparison
  map_to_config.py                       # approved result -> config_json
  validate_config.py                     # validate against Layer 1 rules
```

Templates (markdown) can live under `docs/deep_research/profile_learning/` for analyst instructions (e.g. how to label, how to fill extraction for a report).

---

## 8. MVP recommendation

The **smallest useful version** to build first:

1. **Input model only**
   - Define the report input package and batch manifest (JSON).
   - Manually create one batch of 5–10 reports with `report_file`, `company_identity`, `user_label`, `analyst_notes`.

2. **Extraction: manual + template**
   - Publish the extraction schema (Section 2) as a YAML/JSON schema and a **markdown template** (or simple form) that analysts fill per report.
   - No NLP/LLM in MVP; extraction is human-filled from reading the report.
   - Output: one JSON file per report in a folder.

3. **Batch comparison: single script**
   - One script that:
     - Reads a manifest and all extraction JSONs.
     - Stratifies by label; computes common positive/negative traits, candidate exclusion rules, candidate archetypes, candidate variables/weights using simple rules (e.g. frequency ≥ 2, range intersection).
     - Writes a **comparison result** JSON file.

4. **Human review: file-based**
   - Analysts open the comparison result JSON, edit it (remove/adjust rules and archetypes, set weights), and save as “approved” (e.g. copy to `approved_comparison_result.json` or rename).

5. **Profile generation: script + API**
   - Script reads the approved comparison result, maps to `config_json` (Section 6), validates, then calls the existing screening API to create a new profile version (or uploads config for manual paste into UI).
   - No “review prompts” persistence in MVP if not yet used by the app; keep them in the comparison result for future use.

6. **No admin UI in MVP**
   - Use files + scripts + existing screening UI to create/activate profiles. Add a small “profile learning” admin UI in a later iteration if the process becomes frequent.

---

## 9. Summaries

### 9.1 Recommended profile-learning workflow

1. **Prepare batch** — Build a batch manifest and report packages (report file ref, company identity, user_label, analyst_notes).
2. **Extract** — For each report, produce one extraction document (manual or tool-assisted) using the canonical extraction schema.
3. **Compare** — Run the batch comparison script on all extractions → one comparison result (common traits, candidate exclusions, archetypes, variables, weights, review prompts).
4. **Review** — Analysts review and edit the comparison result; sign off when approved.
5. **Generate** — Map approved result to Layer 1 `config_json`; validate; create new screening_profile_version via API or script.
6. **Activate** — In the existing Layer 1 UI, set the new version as active for the chosen profile.

### 9.2 Minimal viable profile-learning process

- **Input:** JSON manifest + N report packages (file ref + identity + label + notes).
- **Extraction:** Human-filled extraction JSON per report (schema + template).
- **Comparison:** One script → one comparison result JSON.
- **Review:** Edit comparison result in place or copy to “approved” file.
- **Output:** Script maps approved result to `config_json` and creates a new profile version (API or manual paste).
- **No** extraction automation and **no** profile-learning UI in MVP.

### 9.3 Future automation opportunities

- **Extraction:** Use an LLM or structured model to propose extraction from report text (PDF/HTML), with human review and correction.
- **Comparison:** Richer aggregation (e.g. statistical range fitting, clustering of narrative tags for archetypes).
- **Review:** Dedicated admin UI for editing comparison result, diffing versions, and one-click “create profile version”.
- **Review prompts:** Persist in DB or config and surface in AI Lab handoff when a company matches an archetype or score band.
- **Feedback loop:** When companies that passed Layer 1 are later rejected (or advanced) in AI Lab, feed that back as new labels for a future batch and re-run comparison to refine weights and exclusions.
- **Incremental learning:** Support adding new reports to an existing batch and re-running comparison without starting from scratch (e.g. merge new extractions and recompute).

---

*Document version: 1.0. Aligns with Layer 1 screening profiles and profile versions as of migration 033 and universe API (exclusion_rules, archetypes, profile_weighted_score).*
