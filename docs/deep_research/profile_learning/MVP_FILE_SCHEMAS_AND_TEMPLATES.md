# Profile-Learning MVP: File Schemas and Templates

## Purpose

This document defines the **exact file formats and examples** for the MVP file-based profile-learning workflow. It converts ~20 Deep Research reports into an approved Layer 1 screening profile via: batch manifest → per-report extraction → comparison result → approved comparison → generated profile config.

**Format choice:** All artifact files use **JSON**. Layer 1 `config_json` is JSON; the screening API consumes JSON; a single format keeps tooling simple and avoids YAML/JSON interop. Human editing is done in editors with JSON validation; large blocks of analyst text can live in string fields.

---

## 1. Batch manifest

### 1.1 Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_id` | string | Yes | Unique id for this batch (e.g. `learning-batch-2025-Q1`). |
| `batch_name` | string | Yes | Human-readable name (e.g. "Q1 2025 Deep Research learning batch"). |
| `created_at` | string (ISO 8601) | Yes | When the manifest was created. |
| `analyst` | string | No | Primary analyst or team name. |
| `notes` | string | No | Batch-level notes (scope, criteria, caveats). |
| `reports` | array of report entries | Yes | One entry per report in the batch. |

**Report entry (each element of `reports`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `report_id` | string | Yes | Unique id within batch (e.g. `report-001`). |
| `file_path` | string | Yes | Relative or absolute path to the report file (PDF, HTML, etc.). |
| `orgnr` | string | No | Swedish org number when known. |
| `legal_name` | string | Yes | Company legal name. |
| `segment` | string | No | Segment or industry (e.g. "B2B software"). |
| `user_label` | string | Yes | One of: `strong`, `maybe`, `weak`, `reject`. |
| `analyst_notes` | string | No | Free-text notes for this report. |

### 1.2 Example

See `examples/batch_manifest.json` in this directory.

---

## 2. Per-report extraction file

One JSON file per report; filename convention: `extraction_<report_id>.json` (e.g. `extraction_report-001.json`).

### 2.1 Schema

**Root:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `report_metadata` | object | Yes | Links to batch and report. |
| `financial_traits` | object | No | See below. |
| `business_traits` | object | No | See below. |
| `market_traits` | object | No | See below. |
| `operational_value_levers` | object | No | See below. |
| `risk_rejection_signals` | object | No | See below. |
| `archetype_hints` | object | No | See below. |
| `exclusion_hints` | object | No | See below. |
| `screenability_classification` | object | Yes | See below. |

**report_metadata:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `report_id` | string | Yes | Must match manifest. |
| `batch_id` | string | No | Batch this extraction belongs to. |
| `file_path` | string | No | Report file path (echo from manifest). |
| `orgnr` | string | No | Company orgnr. |
| `legal_name` | string | No | Company legal name. |
| `segment` | string | No | Segment. |
| `user_label` | string | Yes | strong / maybe / weak / reject. |
| `analyst_notes` | string | No | From manifest or updated. |
| `extracted_at` | string (ISO 8601) | No | When extraction was done. |
| `extracted_by` | string | No | Who did the extraction. |

**Traits with confidence and source:**  
For any extracted item that supports it, use:

- `confidence`: `high` | `medium` | `low` (per item or per section).
- `source_section`: string (e.g. "Executive summary", "Market analysis").
- `source_quote` or `source_page`: optional traceability.

**financial_traits:**

| Field | Type | Description |
|-------|------|-------------|
| `revenue_range_sek` | [number, number] or null | Min–max revenue in SEK. |
| `ebitda_margin_range` | [number, number] or null | Min–max margin (ratio, e.g. 0.08–0.15). |
| `revenue_cagr_range` | [number, number] or null | Min–max revenue CAGR (ratio). |
| `growth_trajectory` | string | stable | improving | declining | volatile. |
| `margin_trajectory` | string | stable | improving | declining | volatile. |
| `leverage_note` | string | low | moderate | high | unknown. |
| `raw_metrics` | object | Key-value numeric metrics from report. |
| `confidence` | string | high | medium | low (section-level). |
| `source_section` | string | Report section(s) used. |

**business_traits:**

| Field | Type | Description |
|-------|------|-------------|
| `business_model_tags` | string[] | e.g. ["B2B", "recurring revenue", "platform"]. |
| `customer_concentration` | string | low | moderate | high | unknown. |
| `geography` | string[] | e.g. ["Nordics", "EU"]. |
| `product_scope` | string[] | e.g. ["SaaS", "services"]. |
| `fragmentation_signal` | boolean | true if market described as fragmented. |
| `confidence` | string | Section-level. |
| `source_section` | string | Report section(s). |

**market_traits:**

| Field | Type | Description |
|-------|------|-------------|
| `market_size_mention` | string | Free text or structured. |
| `market_cagr_mention` | string | Free text or structured. |
| `structural_trends` | string[] | e.g. ["digitalization", "consolidation"]. |
| `niche_attractiveness` | string | high | medium | low | unknown. |
| `confidence` | string | Section-level. |
| `source_section` | string | Report section(s). |

**operational_value_levers:**

| Field | Type | Description |
|-------|------|-------------|
| `levers` | string[] | e.g. ["buy-and-build", "D2C shift"]. |
| `ops_upside` | string | high | medium | low | unknown. |
| `professionalization_potential` | boolean | Whether report suggests potential. |
| `confidence` | string | Section-level. |
| `source_section` | string | Report section(s). |

**risk_rejection_signals:**

| Field | Type | Description |
|-------|------|-------------|
| `deal_breakers` | string[] | e.g. ["customer concentration", "regulatory risk"]. |
| `risk_flags` | string[] | e.g. ["margin pressure", "key person"]. |
| `rejection_reasons` | string[] | Explicit reasons when label is reject/weak. |
| `confidence` | string | Section-level. |
| `source_section` | string | Report section(s). |

**archetype_hints:**

| Field | Type | Description |
|-------|------|-------------|
| `suggested_codes` | string[] | e.g. ["growth_platform", "margin_turnaround"]. |
| `criteria_hints` | object | Layer 1 field name → { gte?, lte?, between? } (numeric) or eq (string). |
| `narrative_tags` | string[] | Free-form tags for clustering. |
| `confidence` | string | Section-level. |

**exclusion_hints:**

| Field | Type | Description |
|-------|------|-------------|
| `suggested_exclusions` | array | Each: { "field", "op", "value" }; field must be Layer 1–allowed. |
| `rationale` | string | Why these exclusions (e.g. "reject set had margin < 5%"). |
| `confidence` | string | Section-level. |

**screenability_classification:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `screenable_directly` | string[] | Yes (array, may be empty) | Trait/theme that maps directly to a Layer 1 variable or filter (e.g. "revenue_latest", "ebitda_margin_latest"). |
| `screenable_by_proxy` | string[] | Yes (array, may be empty) | Trait that can be approximated by Layer 1 (e.g. "growth" → revenue_cagr_3y). |
| `not_screenable_in_layer_1` | string[] | Yes (array, may be empty) | Important theme that Layer 1 cannot capture (e.g. "customer concentration", "regulatory risk"); note for Layer 2/3. |

### 2.2 Example

See `examples/extraction_report_001.json` in this directory.

---

## 3. Comparison result file

Single JSON file produced by the batch comparison step (e.g. `comparison_result.json`). Not yet approved for profile generation.

### 3.1 Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_id` | string | Yes | From manifest. |
| `generated_at` | string (ISO 8601) | Yes | When comparison was run. |
| `report_count` | integer | Yes | Number of reports in batch. |
| `label_counts` | object | Yes | Counts per label. |
| `common_positive_traits` | object | No | Aggregated positive traits. |
| `common_negative_traits` | object | No | Aggregated negative traits. |
| `candidate_exclusion_rules` | array | No | Suggested exclusion rules. |
| `candidate_archetypes` | array | No | Suggested archetypes. |
| `candidate_variables` | array | No | Suggested Layer 1 variables. |
| `candidate_weights` | object | No | var_id → weight. |
| `layer2_review_prompts` | array | No | Prompts for AI Lab / Layer 2 review. |
| `layer3_research_priorities` | array | No | Research priorities for deep dive. |
| `unresolved_items` | array | No | Items needing analyst decision. |

**label_counts:**

```json
{
  "strong": 8,
  "maybe": 5,
  "weak": 4,
  "reject": 3
}
```

**common_positive_traits / common_negative_traits:**

| Field | Type | Description |
|-------|------|-------------|
| `financial` | array | Items: { "trait", "range" or "value", "support_count", "report_ids"[]? }. |
| `business` | array | Same shape. |
| `market` | array | Same shape. |
| `operational_levers` | array | Same shape. |
| `risk_signals` | array | (negative only) Same shape. |

**candidate_exclusion_rules** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `field` | string | Layer 1 field name. |
| `op` | string | `=`, `>=`, `<=`, `between`. |
| `value` | number or [number, number] | For `between`, two numbers. |
| `support_count` | integer | How many reports suggested this. |
| `rationale` | string | Short explanation. |

**candidate_archetypes** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Archetype code (e.g. "growth_platform"). |
| `criteria` | object | Field → { gte?, lte?, between?, eq? }. |
| `support_count` | integer | Reports supporting. |
| `description` | string | Human-readable description. |

**candidate_variables** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Variable id (used in weights). |
| `source` | string | Universe row field name. |
| `normalize` | string | `min_max` or `linear`. |
| `range` | [number, number] | For normalization. |
| `support_note` | string | Why included. |

**candidate_weights:**  
Object: keys = variable `id`, value = number (e.g. `"revenue_growth": 0.35`). Need not sum to 1; mapping step can normalize.

**layer2_review_prompts** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique id. |
| `label` | string | Short label (e.g. "Strong fit"). |
| `prompt_text` | string | Text for AI Lab / review. |
| `when_archetype` | string | Optional; show when this archetype_code. |
| `when_score_band` | string | Optional; e.g. "high" for top quartile. |

**layer3_research_priorities** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `topic` | string | e.g. "Customer concentration". |
| `rationale` | string | Why important. |
| `source_reports` | string[] | report_ids that raised this. |

**unresolved_items** (each item):

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | e.g. "conflicting_threshold", "missing_field". |
| `description` | string | What needs decision. |
| `options` | array | Optional; e.g. suggested values. |
| `report_ids` | string[] | Related reports. |

### 3.2 Example

See `examples/comparison_result.json` in this directory.

---

## 4. Approved comparison file

Analyst-reviewed version of the comparison result, ready to map into Layer 1. Typically named `approved_comparison.json` or `approved_comparison_<batch_id>.json`.

### 4.1 Schema

Extends comparison result with approval metadata and **approved_*** copies of the sections that feed Layer 1. Other comparison fields (e.g. common_positive_traits, unresolved_items) may be kept for audit.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_id` | string | Yes | From comparison. |
| `approved_by` | string | Yes | Analyst or team identifier. |
| `approved_at` | string (ISO 8601) | Yes | When approved. |
| `revision_notes` | string | No | What was changed in review. |
| `approved_variables` | array | Yes | Final variables for config (same shape as candidate_variables). |
| `approved_weights` | object | Yes | var_id → weight. |
| `approved_archetypes` | array | Yes | Final archetypes (code, criteria; optional description). |
| `approved_exclusion_rules` | array | Yes | Final exclusion rules (field, op, value). |
| `approved_review_prompts` | array | No | Final layer2_review_prompts to persist. |

Approved arrays/objects must conform to Layer 1 expectations (see Section 5). Optional: retain `common_positive_traits`, `common_negative_traits`, `unresolved_items` (e.g. with resolutions) for traceability.

### 4.2 Example

See `examples/approved_comparison.json`. The result of mapping that file to Layer 1 config is in `examples/output_config_json.json`.

---

## 5. Mapping spec: approved comparison → config_json

This section defines the **exact mapping** from the approved comparison file to `screening_profile_versions.config_json`, and how to reject incompatible items.

### 5.1 Target: config_json shape

```json
{
  "variables": [ { "id", "source", "normalize", "range" } ],
  "weights": { "<var_id>": number },
  "archetypes": [ { "code", "criteria" } ],
  "exclusion_rules": [ { "field", "op", "value" } ]
}
```

Optional (not required by current Layer 1 runtime): `review_prompts` array for future use.

### 5.2 Field-by-field mapping

| Approved comparison field | config_json field | Mapping rule |
|---------------------------|-------------------|--------------|
| `approved_variables` | `config.variables` | Copy each item; keep only `id`, `source`, `normalize`, `range`. Reject items with invalid `source` (see 5.3). |
| `approved_weights` | `config.weights` | Copy as-is. Reject keys that do not appear in `approved_variables[].id`. Optionally normalize so values sum to 1. |
| `approved_archetypes` | `config.archetypes` | Each item → `{ "code": item.code, "criteria": item.criteria }`. Drop `support_count`, `description`. Reject criteria keys not in allowed list (see 5.3). |
| `approved_exclusion_rules` | `config.exclusion_rules` | Copy each `{ "field", "op", "value" }`. Reject if field not allowed or value type wrong (see 5.3). |
| `approved_review_prompts` | (optional) `config.review_prompts` or separate store | Copy as-is if storing in config; else persist elsewhere. |

### 5.3 Validation rules and rejections

**Variables**

- **Allowed `source` values (Universe row fields used in profile-weighted score):**  
  `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, `employees_latest`, `data_quality_score`, `fit_score`, `ops_upside_score`, `nivo_total_score`, `research_feasibility_score`.  
  Any other `source` → **reject** that variable (do not include in config).
- `normalize` must be `min_max` or `linear`. Else **reject** or default to `min_max`.
- `range` must be `[number, number]` with range[0] < range[1]. Else **reject** that variable or skip normalization for that variable (backend may treat missing range differently; for MVP, require valid range).

**Weights**

- Every key in `config.weights` must exist in `config.variables[].id`. Remove any weight whose key is not in approved_variables.
- Weights can be any non-negative numbers; normalization to sum 1 is optional (backend uses weighted sum / total weight).

**Archetypes**

- **Allowed criteria field names (for archetype matching):**  
  Any numeric field present on the Universe row used in the query (e.g. `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, `employees_latest`, `data_quality_score`, `fit_score`, `ops_upside_score`, `nivo_total_score`, `segment_tier`). For `segment_tier` and `name`, only `eq`, `gte`, `lte` are valid (string comparison).  
  Unknown criteria fields → **reject** that archetype or strip that criterion.
- Criteria value types: numeric criteria use numbers; `between` must be `[number, number]`.

**Exclusion rules**

- **Allowed `field` values (must match backend):**  
  `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, `employees_latest`, `data_quality_score`, `fit_score`, `ops_upside_score`, `nivo_total_score`, `research_feasibility_score`.
- **Allowed `op` values:** `=`, `>=`, `<=`, `between`. For `between`, `value` must be `[number, number]`.
- **Value types (by field):**  
  - `percent` (ratio): `ebitda_margin_latest`, `revenue_cagr_3y` — value as ratio (e.g. 0.05).  
  - `number`: all others — value as number.  
  Any rule with disallowed field, op, or value type → **reject** that rule.

### 5.4 Rejection log (recommended)

When generating config, output a **rejection log** (e.g. array or file) listing:

- Rejected variable (id/source) and reason.
- Rejected weight key (no matching variable).
- Rejected or trimmed archetype (code + reason).
- Rejected exclusion rule (field/op/value + reason).

This supports audit and fixing the approved comparison file.

---

## 6. Suggested folder structure

Use a single root folder per batch so paths stay portable and outputs are grouped.

```
profile_learning/
├── batches/
│   └── <batch_id>/
│       ├── manifest.json                 # Batch manifest (1.2)
│       ├── reports/                      # Raw report files (PDFs, etc.)
│       │   ├── company_a_deep_research.pdf
│       │   └── ...
│       ├── extractions/                  # One JSON per report
│       │   ├── extraction_report-001.json
│       │   ├── extraction_report-002.json
│       │   └── ...
│       ├── comparison/                   # Comparison step outputs
│       │   ├── comparison_result.json
│       │   └── unresolved_items.log      # Optional: export of unresolved_items
│       ├── approved/                    # After human review
│       │   ├── approved_comparison.json
│       │   └── revision_notes.txt        # Optional: free-form notes
│       └── output/                      # Generated profile config
│           ├── config_json.json          # Ready for screening_profile_versions.config_json
│           ├── mapping_rejection_log.json
│           └── profile_version_metadata.json   # Optional: version, profile name, etc.
│
└── schema_docs/                          # Optional: JSON Schema files
    ├── batch_manifest.schema.json
    ├── extraction.schema.json
    ├── comparison_result.schema.json
    └── approved_comparison.schema.json
```

**Conventions:**

- `manifest.json` lives in the batch root; `file_path` in manifest can be relative to batch root (e.g. `reports/company_a_deep_research.pdf`).
- Extraction files are named `extraction_<report_id>.json`; `report_id` must match manifest.
- Comparison script reads `manifest.json` + all `extractions/*.json`, writes `comparison/comparison_result.json`.
- Analyst copies or moves comparison result to `approved/approved_comparison.json` after editing and adds approval metadata.
- Mapping script reads `approved/approved_comparison.json`, writes `output/config_json.json` and optionally `output/mapping_rejection_log.json`.

---

## 7. Recommended MVP file set

For one full run of the profile-learning MVP:

| # | File | Purpose |
|---|------|---------|
| 1 | `batches/<batch_id>/manifest.json` | Batch definition and report list (report_id, file_path, orgnr, legal_name, segment, user_label, analyst_notes). |
| 2 | `batches/<batch_id>/extractions/extraction_<report_id>.json` | One per report: metadata, traits, hints, screenability classification. |
| 3 | `batches/<batch_id>/comparison/comparison_result.json` | Aggregated comparison (label_counts, candidates, layer2/layer3 prompts, unresolved_items). |
| 4 | `batches/<batch_id>/approved/approved_comparison.json` | Approved variables, weights, archetypes, exclusion_rules, review_prompts + approval metadata. |
| 5 | `batches/<batch_id>/output/config_json.json` | Final JSON to paste or POST into screening_profile_versions.config_json. |
| 6 | (Optional) `batches/<batch_id>/output/mapping_rejection_log.json` | Rejected items during mapping for audit. |

No application code is required to run the workflow manually: create/edit JSON with the schemas above, then use a mapping script or manual copy to produce `config_json.json`.

---

## 8. Recommended working process for analysts

1. **Create batch:** Add `manifest.json` under `batches/<batch_id>/`. Fill batch_id, batch_name, created_at, analyst, notes. Add one `reports[]` entry per report (report_id, file_path, orgnr, legal_name, segment, user_label, analyst_notes). Place report files under `reports/`.
2. **Extract per report:** For each report, create `extractions/extraction_<report_id>.json` from the extraction schema. Fill report_metadata (match report_id and user_label to manifest). Fill financial_traits, business_traits, market_traits, operational_value_levers, risk_rejection_signals, archetype_hints, exclusion_hints; add confidence/source_section where useful. Complete screenability_classification (screenable_directly, screenable_by_proxy, not_screenable_in_layer_1).
3. **Run comparison:** Run the comparison script (when implemented) over manifest + extractions; it writes `comparison/comparison_result.json`. If no script: manually draft comparison_result.json from the extraction set (label_counts, common traits, candidate rules/archetypes/variables/weights, layer2_review_prompts, layer3_research_priorities, unresolved_items).
4. **Review and approve:** Open `comparison_result.json`. Resolve unresolved_items; add/remove/edit candidate_exclusion_rules, candidate_archetypes, candidate_variables, candidate_weights, layer2_review_prompts. Save as `approved/approved_comparison.json`. Add approved_by, approved_at, revision_notes, and copy the approved sections into approved_variables, approved_weights, approved_archetypes, approved_exclusion_rules, approved_review_prompts.
5. **Generate config:** Run mapping (script or manual) from approved_comparison.json → config_json. Apply validation rules; log rejections to mapping_rejection_log.json. Write `output/config_json.json`.
6. **Load into Layer 1:** In the app, create or select a screening profile; create a new version with config_json from output/config_json.json; activate when ready.

---

## 9. Common failure modes to avoid

- **Manifest file_path vs actual files:** Keep `file_path` relative to the batch root and ensure report files exist under `reports/` so extraction and future tooling can find them.
- **report_id mismatch:** Use the same report_id in manifest, extraction filename (`extraction_<report_id>.json`), and inside extraction `report_metadata.report_id`.
- **Wrong exclusion field or type:** Only use Layer 1–allowed exclusion fields; use ratio for percent fields (e.g. 0.05 not 5 for margin). Otherwise rules are dropped in mapping.
- **Variable source not in Universe:** Only use variable `source` values that the Universe query returns and the backend uses for profile_weighted_score. Otherwise the variable is rejected and the weight for that id is ineffective.
- **Archetype criteria on unknown fields:** Use only numeric row fields or segment_tier/name with eq/gte/lte; otherwise the criterion is stripped or the archetype rejected.
- **Approved file missing approval metadata:** Always set approved_by, approved_at, and the approved_* arrays so the mapping step has a single source of truth.
- **Weights without matching variables:** Ensure every key in approved_weights exists in approved_variables; otherwise those weights are dropped and the score can change.
- **Editing comparison_result instead of saving to approved_comparison:** Keep the raw comparison result unchanged; do all final edits in the approved file so you can re-run comparison and diff later.
- **Skipping screenability_classification:** Filling screenable_directly / screenable_by_proxy / not_screenable_in_layer_1 improves later comparison and clarifies what belongs in Layer 1 vs Layer 2/3.
