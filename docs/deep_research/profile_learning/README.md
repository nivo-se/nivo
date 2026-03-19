# Profile-learning MVP: file schemas and templates

This folder contains the **concrete file schemas and examples** for the MVP file-based profile-learning workflow.

- **Design:** [PROFILE_LEARNING_PIPELINE_DESIGN.md](../PROFILE_LEARNING_PIPELINE_DESIGN.md) — overall pipeline design.
- **Schemas and process:** [MVP_FILE_SCHEMAS_AND_TEMPLATES.md](./MVP_FILE_SCHEMAS_AND_TEMPLATES.md) — exact schemas, mapping spec, folder structure, and analyst process.
- **Examples:** [examples/](./examples/) — sample JSON for manifest, extraction, comparison result, approved comparison, and generated config.

Use the examples as templates when creating batches under a `batches/<batch_id>/` structure (see folder structure in the schemas doc).

---

## Offline toolkit (MVP)

The repo includes an offline Python toolkit to validate batches and approved comparison files and to generate Layer 1 `config_json` and rejection logs.

**Location:** `profile_learning/` (repo root) + `scripts/profile_learning_cli.py`

**Commands (run from repo root):**

```bash
# Validate a batch folder (manifest, report files, extraction JSONs)
python3 -m profile_learning.cli validate-batch path/to/batches/<batch_id>

# Validate an approved comparison file
python3 -m profile_learning.cli validate-approved path/to/approved_comparison.json

# Generate config_json.json and mapping_rejection_log.json
python3 -m profile_learning.cli generate-config path/to/approved_comparison.json [--output-dir path/to/output]
```

If `--output-dir` is omitted, output files are written next to the approved comparison file. See implementation summary in the repo for a short test checklist.

**Runbook:** [RUNBOOK_FIRST_SCREENING_PROFILE.md](./RUNBOOK_FIRST_SCREENING_PROFILE.md) — exact steps to prepare the first approved comparison, generate config, create and activate a screening profile, query Universe with it, and review the ranked output.
