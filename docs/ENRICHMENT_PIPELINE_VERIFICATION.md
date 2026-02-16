# Enrichment Pipeline Verification Runbook

**Goal:** Verify enrichment data flows from Postgres → backend → frontend before tuning prompts.

## 1) Confirm data exists in the DB

### A. Status check

```bash
# If prod uses auth, run locally with REQUIRE_AUTH=false first
curl -s http://localhost:8000/api/status | jq '.counts, .db_source, .tables_ok'
```

Confirm:
- `db_source` = `postgres` (for Supabase-hosted)
- `tables_ok.company_enrichment`, `tables_ok.ai_profiles` = true
- `counts.company_enrichment`, `counts.ai_profiles` > 0

### B. Golden orgnr

```bash
DATABASE_SOURCE=postgres python3 scripts/get_intel_orgnr.py
```

Saves an orgnr with enrichment for UX testing.

---

## 2) Verify backend feeds

Using the golden orgnr:

| Endpoint | Check |
|----------|-------|
| `GET /api/companies/{orgnr}/intel` | Returns `artifacts`, `enrichment`, `ai_summary` |
| `GET /api/companies/{orgnr}/ai-report` | Returns report or empty; `POST /api/ai-reports/generate` triggers generation |
| `POST /api/companies/batch` with `include_ai: true` | Returns `ai_summary` per company for list views |

---

## 3) Verify frontend UX

### A. Auth

- User logs in (Supabase)
- DevTools → Network → every backend request has `Authorization: Bearer <token>`

### B. The 3 screens

1. **List / search** – loads companies (batch with `include_ai`)
2. **Company detail** – loads intel + artifacts
3. **AI Deep Dive** – loads ai-report, can generate if missing

### C. Data mapping

See [AI_ENDPOINTS_FRONTEND.md](AI_ENDPOINTS_FRONTEND.md). Ensure UI handles empty states when kinds are missing.

---

## 4) Quick verification script

```bash
# Backend must be running (e.g. uvicorn backend.api.main:app)
BASE_URL=http://localhost:8000 python3 scripts/verify_enrichment_pipeline.py
```

Outputs status counts, golden orgnr, and first ~30 lines of `/intel` so you can reply with the 4 answers:

1. Where is the backend running? (local / Railway / Render / Fly / VPS)
2. `counts.company_enrichment` and `counts.ai_profiles`
3. Golden orgnr + first ~30 lines of `/api/companies/{orgnr}/intel`
4. First page to fix: list / company detail / deep dive
