# Profile-learning toolkit: test checklist

Use this checklist to verify the offline toolkit after changes.

## 1. Batch validator

- [ ] **Valid batch:** Run `validate-batch` on a folder that has `manifest.json`, report files at paths in manifest, and optional `extractions/*.json` with `report_metadata` and `screenability_classification`. Expect: `OK: batch valid`.
- [ ] **Missing manifest:** Run on a folder without `manifest.json`. Expect: `ERROR: manifest.json not found`.
- [ ] **Invalid manifest JSON:** Run on a folder where `manifest.json` is not valid JSON. Expect: `ERROR: manifest.json invalid JSON`.
- [ ] **Missing required manifest field:** Remove `batch_id` or `reports` from manifest. Expect: error listing missing field.
- [ ] **Invalid user_label:** Set a report's `user_label` to `"invalid"`. Expect: error for invalid user_label.
- [ ] **Missing report file:** Point manifest `file_path` to a path that does not exist. Expect: error that report file not found.
- [ ] **Invalid extraction JSON:** Add an extraction file that is not valid JSON. Expect: error for that file.
- [ ] **Extraction missing screenability_classification:** Remove `screenability_classification` from an extraction. Expect: error for that file.

## 2. Approved comparison validator

- [ ] **Valid approved file:** Run `validate-approved` on `docs/deep_research/profile_learning/examples/approved_comparison.json`. Expect: `OK: approved comparison valid`.
- [ ] **Invalid source:** Set a variable `source` to `"invalid_source"`. Expect: error that source not in allowed list.
- [ ] **Invalid normalize:** Set `normalize` to `"invalid"`. Expect: error.
- [ ] **Invalid range:** Set variable `range` to `[1, 0]` or non-numeric. Expect: error.
- [ ] **Orphan weight:** Add a key in `approved_weights` that is not in `approved_variables[].id`. Expect: error.
- [ ] **Invalid exclusion field/op:** Set an exclusion rule `field` to `"unknown"` or `op` to `">"`. Expect: errors.

## 3. Config generator

- [ ] **Valid approved → config:** Run `generate-config` on `docs/deep_research/profile_learning/examples/approved_comparison.json` with `--output-dir /tmp/out`. Expect: `config_json.json` and `mapping_rejection_log.json` written; rejection log empty.
- [ ] **Generated config shape:** Open `config_json.json`. Expect: top-level keys `variables`, `weights`, `archetypes`, `exclusion_rules`; each variable has `id`, `source`, `normalize`, `range`; archetypes have only `code` and `criteria` (no `description`).
- [ ] **Invalid approved → rejections:** Run `generate-config` on a file with invalid variable source, orphan weight, invalid exclusion field. Expect: same files written; `mapping_rejection_log.json` contains one entry per rejected item with `type`, `identifier`, `reason`.
- [ ] **Rejected variable omitted from config:** In the invalid run, confirm that variables with disallowed `source` do not appear in `config_json.variables` and their weights do not appear in `config.weights`.

## 4. CLI

- [ ] **Help:** Run `python3 -m profile_learning.cli --help` and each subcommand with `--help`. Expect: usage and options.
- [ ] **Script entry point:** Run `python3 scripts/profile_learning_cli.py validate-approved path/to/approved_comparison.json` from repo root. Expect: same result as `python3 -m profile_learning.cli validate-approved ...`.
