# API Contract

Frozen contract for core Nivo intelligence endpoints. Fields marked **stable** are guaranteed; **extras** may change.

---

## Endpoints

### GET /api/status

Health and DB readiness. No request body.

**Response (stable):**
```json
{
  "status": "healthy",
  "api": "healthy",
  "db_source": "postgres",
  "db_ok": true,
  "tables_ok": {
    "companies": true,
    "financials": true,
    "company_kpis": true,
    "enrichment_runs": true,
    "company_enrichment": true
  },
  "counts": {
    "companies": 13610,
    "financials": 45000,
    "company_kpis": 13610,
    "enrichment_runs": 2,
    "company_enrichment": 150
  }
}
```

**Extras:** `supabase`, `redis` (when applicable).

---

### GET /api/companies/{orgnr}/intel

All intelligence data for a company.

**Request:** Path param `orgnr` (Swedish org number).

**Response (stable):**
```json
{
  "orgnr": "5560022617",
  "company_id": null,
  "domain": "https://example.com",
  "industry": "Technology",
  "tech_stack": ["react", "node"],
  "digital_maturity_score": 75,
  "artifacts": [
    {
      "id": "5560022617-llm_analysis",
      "source": "llm_analysis",
      "artifact_type": "llm_analysis",
      "url": null,
      "content": "{...}",
      "created_at": "2025-01-15T12:00:00"
    }
  ]
}
```

**Extras:** `ai_profile`, `enrichment`, `ai_summary`, `run_id_by_kind`. See [ENRICHMENT_KINDS.md](ENRICHMENT_KINDS.md).

---

### GET /api/companies/{orgnr}/ai-report

Latest AI report for a company. Cache-first from `company_enrichment`.

**Request:** Path param `orgnr`.

**Response (stable):**
```json
{
  "orgnr": "5560022617",
  "business_model": "B2B SaaS provider...",
  "weaknesses": ["Manual processes", "Legacy systems"],
  "uplift_ops": [
    { "name": "Automate billing", "impact": "High", "effort": "Medium" }
  ],
  "impact_range": "Medium",
  "outreach_angle": "Fokus på digitalisering..."
}
```

**Extras:** `ai_summary`, `run_id_by_kind`.

---

### POST /api/ai-reports/generate

Generate AI report (cache-first). Canonical entrypoint.

**Request:**
```json
{
  "orgnr": "5560022617",
  "force_regenerate": false,
  "force_regen": false
}
```

**Response (stable):**
```json
{
  "orgnr": "5560022617",
  "business_model": "B2B SaaS provider...",
  "weaknesses": ["Manual processes"],
  "uplift_ops": [
    { "name": "Automate billing", "impact": "High", "effort": "Medium" }
  ],
  "impact_range": "Medium",
  "outreach_angle": "Fokus på digitalisering...",
  "cached": true
}
```

**Cache behavior:**
- If `company_enrichment` has `ai_report` or composable `llm_analysis`, returns with `cached: true`.
- Set `AI_REPORT_MAX_AGE_DAYS` (env) to reject reports older than N days.
- Use `force_regenerate: true` or `force_regen: true` to bypass cache.
- See [ENRICHMENT_KINDS.md](ENRICHMENT_KINDS.md).

---

### POST /api/enrichment/run

Run batch enrichment.

**Request:**
```json
{
  "orgnrs": ["5560022617", "5560125790"],
  "list_id": null,
  "kinds": ["llm_analysis", "company_profile", "website_insights"]
}
```

- `orgnrs`: explicit list (or omit and use `list_id`).
- `list_id`: UUID from `saved_company_lists` to resolve orgnrs.
- `kinds`: optional; default `["llm_analysis", "company_profile", "website_insights"]`.

**Response (stable):**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "queued_count": 2
}
```

---

### GET /api/enrichment/run/{run_id}/status

Status of an enrichment run.

**Request:** Path param `run_id` (UUID).

**Response (stable):**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "counts_by_kind": {
    "llm_analysis": 2
  },
  "completed": 2,
  "failed": 0,
  "failures": [
    { "orgnr": "5560999999", "error": "Company not found" }
  ]
}
```

**Extras:** `failures` — per-orgnr errors when batch had failures.

---

## References

- [ENRICHMENT_KINDS.md](ENRICHMENT_KINDS.md) — canonical kinds and aliases
- `AI_REPORT_MAX_AGE_DAYS` — optional staleness threshold (days)
- `force_regenerate` / `force_regen` — bypass report cache
