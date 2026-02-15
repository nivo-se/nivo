# Enrichment Kinds

Canonical kinds for `company_enrichment.kind`. Avoid introducing new kinds without updating this doc.

## Canonical kinds

| Kind | Description |
|------|-------------|
| `llm_analysis` | LLM-generated analysis (business model, risk flags, uplift ops, etc.) from enrichment_worker |
| `ai_report` | Composed AI report (business_model, weaknesses, uplift_ops, impact_range, outreach_angle) from POST /api/ai-reports/generate |
| `company_profile` | Structured company profile (what_they_do, customer_type, etc.) |
| `website_insights` | Website-scraped insights (insights_json with what_they_do, weaknesses, uplift_ops) |
| `about_summary` | About-page summary (about_text, services_text, hero_text) |

## Legacy alias

- `ai_analysis` → treated as `llm_analysis` for backward compatibility. New writes use `llm_analysis`.

## Source of truth

- enrichment_worker: writes `llm_analysis`
- ai_report_service.persist_ai_report: writes `ai_report`
- migrate_v2_ai_to_postgres: may import existing kinds from donor DB
