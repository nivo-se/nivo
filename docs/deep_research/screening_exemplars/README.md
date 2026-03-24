# Screening exemplar corpus

Structured mandate and per-company Deep Research exemplars used to align screening prompts with **what Nivo likes**.

| File | Role |
|------|------|
| [`screening_output.json`](screening_output.json) | Synthesis: `common_patterns`, `archetypes`, `investment_playbook`, `_meta.version` |
| [`exemplar_reports_manifest.json`](exemplar_reports_manifest.json) | List of exemplar `.md` files; optional `orgnr` / `analysisRunId` when linked to Postgres |
| `*.md` | Full Deep Research–style reports per company |

**API:** `GET /api/screening/exemplar-mandate` returns `{ version, meta, keys }` for the loaded JSON (auth as other screening routes).

Bump **`_meta.version`** in `screening_output.json` when you change patterns or archetypes.

## Indexing example reports (optional)

The **playbook** (`screening_output.json`) is loaded by the API from disk — **no script** is required for Layer 1/2 prompts.

**Indexing** only applies to the per-company **`.md`** reports listed in `exemplar_reports_manifest.json`:

1. The indexer reads the manifest, loads each file, and **splits** text into chunks (soft max ~1200 chars).
2. **`--postgres`** upserts rows into `ai_ops.exemplar_report_chunks` (migration `042_exemplar_report_chunks.sql` must be applied first). This powers `GET /api/screening/exemplar-chunks` and the in-app “Search” on **Playbook & examples**.
3. **`--postgres --pgvector`** additionally fills the `embedding` column (requires `OPENAI_API_KEY`).
4. **`--chroma`** rebuilds the local Chroma collection `nivo_exemplar_reports` under `data/chroma_db` for other RAG tooling — not required for the web UI search box.

From the **repository root**, with DB env set (`DATABASE_URL` or `POSTGRES_*`):

```bash
python3 scripts/index_exemplar_markdown.py --postgres
```

To match chunks by org number in the API/UI, set `orgnr` on each manifest entry (and re-run the indexer after changes).
