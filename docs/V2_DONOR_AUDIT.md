# V2 Donor Audit — AI-enriched data from nivo-v2

Audit of donor database (nivo-v2 SQLite) for import into this repo's local Postgres.

## Donor DB path

```text
../Nivo-v2/nivo_optimized.db
```

Or absolute: `/path/to/Nivo-v2/nivo_optimized.db`

---

## Inspected structure (from `inspect_sqlite_db.py`)

### AI-relevant tables

| Table                     | Rows  | pk       | orgnr_col | Purpose                                           |
|---------------------------|-------|----------|-----------|---------------------------------------------------|
| ai_profiles               | 78    | org_number | org_number | Per-company AI analysis (fit score, summary)      |
| clean_llm_analysis       | 24    | orgnr    | orgnr     | LLM thesis analysis (analysis_json)               |
| company_profile           | 1283  | orgnr    | orgnr     | What they do, customer_type, geography, industries |
| company_website_extracts  | 196   | orgnr    | orgnr     | About text, services, hero, contact, keywords     |
| company_website_insights  | 1285  | orgnr    | orgnr     | AI-generated insights (insights_json)             |
| company_website_chunks    | 10852 | chunk_id | orgnr     | Chunked website content (large; optional import)  |
| wash_runs                 | 0     | id       | -         | Run metadata (thesis_version, model, prompt)      |

### Key columns

- **ai_profiles**: org_number, website, product_description, end_market, strategic_fit_score, defensibility_score, business_model_summary, risk_flags, strategic_playbook, next_steps, fit_rationale, etc.
- **clean_llm_analysis**: orgnr, thesis_version, model, prompt_version, analysis_json
- **company_profile**: orgnr, what_they_do, customer_type, confidence, geography_json, industries_json
- **company_website_extracts**: orgnr, about_text, services_text, hero_text, contact_json, keywords_json
- **company_website_insights**: orgnr, generated_at, model, insights_json, content_hash

---

## Mapping to Postgres

| Donor table                 | Postgres table      | kind               | Notes                                |
|-----------------------------|--------------------|--------------------|--------------------------------------|
| ai_profiles                 | ai_profiles        | -                  | Upsert by org_number                 |
| clean_llm_analysis         | company_enrichment | llm_analysis       | analysis_json → result               |
| company_profile             | company_enrichment | company_profile    | Full row as result                   |
| company_website_extracts   | company_enrichment | about_summary      | about_text, services, hero → result  |
| company_website_insights   | company_enrichment | website_insights   | insights_json → result               |

---

## Manual test (Step 5)

```bash
# 1. Set env
export DATABASE_SOURCE=postgres
export POSTGRES_PORT=5433

# 2. Get an orgnr with enrichment
python3 scripts/get_intel_orgnr.py
# → e.g. 5560022617

# 3. Start backend
cd backend
uvicorn api.main:app --host 0.0.0.0 --port 8000

# 4. In another terminal, hit intel + ai-report
curl http://localhost:8000/api/companies/5560022617/intel
curl http://localhost:8000/api/companies/5560022617/ai-report
```
