# REPORT_UI_SCHEMA.md

## Report Structure

Report
- version_number
- created_at
- sections[]
- report_degraded (bool)
- report_degraded_reasons (string[])
- validation_status (optional)

### validation_status

- lint_passed: bool — valuation lint checks passed
- lint_warnings: string[] — valuation lint warnings (e.g. implied multiple outside sector range)

### Status Banner

When `report_degraded` or `validation_status.lint_warnings` or `!validation_status.lint_passed`, show a report-level status banner above the title card with:
- Degraded reasons (when report_degraded)
- Lint warnings (when present)
- "Valuation lint review recommended" when lint_passed is false and no specific warnings

Section
- section_key
- heading
- content_md
- sort_order
- extra (optional) — structured blocks, source_refs, validation_status per section

## Rendering

Use a Markdown renderer with custom blocks for:
- charts
- citations
- claim references

## Source References / Evidence Sidebar

Claims reference source IDs which map to evidence blocks. When `extra.source_refs` is present on a section, render expandable source links (URL, title, excerpt). Future: dedicated evidence sidebar component.