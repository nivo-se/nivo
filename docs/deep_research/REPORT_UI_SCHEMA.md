# REPORT_UI_SCHEMA.md

## Report Structure

Report
- version_number
- created_at
- sections[]

Section
- section_key
- heading
- content_md
- sort_order

## Rendering

Use a Markdown renderer with custom blocks for:
- charts
- citations
- claim references

## Source References

Claims reference source IDs which map to evidence blocks shown in a sidebar.