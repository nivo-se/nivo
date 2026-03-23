# Screening exemplar corpus

Structured mandate and per-company Deep Research exemplars used to align screening prompts with **what Nivo likes**.

| File | Role |
|------|------|
| [`screening_output.json`](screening_output.json) | Synthesis: `common_patterns`, `archetypes`, `investment_playbook`, `_meta.version` |
| [`exemplar_reports_manifest.json`](exemplar_reports_manifest.json) | List of exemplar `.md` files; optional `orgnr` / `analysisRunId` when linked to Postgres |
| `*.md` | Full Deep Research–style reports per company |

**API:** `GET /api/screening/exemplar-mandate` returns `{ version, meta, keys }` for the loaded JSON (auth as other screening routes).

Bump **`_meta.version`** in `screening_output.json` when you change patterns or archetypes.
