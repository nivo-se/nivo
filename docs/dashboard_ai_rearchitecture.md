# Nivo Dashboard Redesign & AI Enrichment Plan

## 1) Diagnosis: Current Gaps
- **Fragmented UX & static cards**: The working dashboard renders fixed metric cards and tab switches without cross-panel coordination or inline drill-downs, leaving no command palette or real-time filters to drive navigation. The experience is largely static and Swedish-only copy blocks reduce clarity for new operators. The overview cards in `WorkingDashboard` hard-code values and lack cohort toggles or contextual tooltips. 
- **Rigid filtering and no weighting**: `supabaseDataService.getCompanies` only applies direct numeric cutoffs for revenue, profit, growth, and headcount, with no percentile controls, sliders, or dynamic scoring weights, making financial screening brittle for portfolio sourcing. 
- **No vector retrieval or intelligence fabric**: There is no embedding store, similarity search, or document ingestion; enrichment is limited to raw Supabase rows and demo data. 
- **Disjoint AI pipeline**: The `agentic_pipeline` package produces deterministic rankings but is not surfaced in the UI or triggered from the app; there is no background worker or API to run orchestrations on new companies. 
- **Shallow company scoring**: Composite scoring is absent from the frontend; the backend ranking weights are static, and there is no “Nivo fit” blending financials with uplift potential, manual overrides, or decision journaling. 
- **Missing intelligence gathering loops**: No modules collect website/tech stack signals, hiring data, SEO/ads, or reviews; there are no cron/scheduler hooks to refresh intel or store AI deep dives per company.

## 2) Proposed Architecture
### UX & Dashboard
- **Command-driven navigation** with a palette (keyboard shortcut) that jumps to companies, filters, cohorts, or saved searches. 
- **Adjustable financial layer**: slider/weight controls for revenue, EBIT, growth, leverage, and headcount with percentile filters; cohort visualizations (scatter/quadrants, density plots) backed by cached analytics. 
- **Company intelligence layer**: After financial pass, trigger enrichment jobs to detect domain, classify industry/product, customer type, pricing, digital maturity, hiring/ads/SEO signals, and capture competitive breadcrumbs. 
- **AI deep dive panels**: Inline summaries, weak point detection, operational uplift assessment, playbooks, impact ranges, and outreach angles stored per company with manual annotations. 
- **Ranking workspace**: Composite score = financial score (weighted sliders) + uplift score (AI) + strategic fit; manual overrides and decision logs are editable inline and auditable.

### Data & Intelligence Stack
- **Data sources**: Supabase (core financials), external enrichment APIs (SerpAPI/Perplexity for search snippets, BuiltWith tech stack, Clearbit-like firmographics, LinkedIn lookups, ad/SEO scrapers), and optional browserless/puppeteer for dynamic sites.
- **Storage**: Extend PostgreSQL/Supabase with `company_intel`, `intel_artifacts`, `ai_reports`, `playbooks`, `decision_log`, and `embeddings` (pgvector) tables.
- **Retrieval**: Use pgvector for company-level document chunks (site content, news, reviews, job posts). Embedding pipeline writes semantic chunks keyed by `company_id` for similarity search in the UI (context panels and summarization).
- **Agents & pipelines**: A background worker (Celery/RQ/BullMQ) orchestrates enrichment -> embedding -> AI analysis -> scoring. Orchestrator uses step functions: financial filter -> enrichment fetchers -> embedding + retrieval -> LLM summarizer -> composite scoring -> persistence.
- **API layer**: Add backend endpoints to trigger enrichment, fetch ranked cohorts, stream AI summaries, and expose vector search. Supabase edge functions or FastAPI services can host this logic.

### Two-stage targeting to avoid the “hen and egg” trap
- **Stage 1 (segmentation + shortlist builder)**: run fast, data-available segmentation on ~50k targets using financial quality, momentum, capital efficiency, and resilience scores. Cohort controls (percentiles, thresholds, cluster selection, exclusions) let operators generate 150–180 “interesting list” companies without needing external intel. Outputs are cached, exportable, and can be re-scored with different weights.
- **Stage 2 (intelligence + uplift scoring)**: manually trigger enrichment + AI screening on the Stage 1 list to converge on ~100 high-confidence candidates. Each run records which filters produced the batch, so we can replicate/refine list generation. Manual overrides and “pin/unpin” controls ensure we keep promising firms even if enrichment is sparse.
- **List-building levers**: saved filter presets (Nivo thesis defaults, growth-yet-resilient, margin-rich), exclusion lists (industries or risk flags), minimum data quality gates, and a “slot budget” indicator showing how many Stage 2 seats remain toward the 100-company goal.
- **Investment-thesis alignment**: defaults emphasize profitable growth in Nordic SMEs (revenue 50–300 MSEK, EBIT margins 10–25%, stable headcount, low leverage) while allowing operator-adjusted weights to explore adjacencies. Stage 1 ensures we always have more than 100 eligible companies so Stage 2 can fill the target batch even when some enrichments fail.

### Why external LLMs & pgvector
- We should **use hosted LLMs (OpenAI/Anthropic)** with structured prompts for classification and summarization to minimize infra and latency. Training our own LLM is unnecessary given limited proprietary text and the need for rapid iteration. 
- **Embeddings in pgvector** allow company-specific retrieval without new services; Supabase supports this natively and aligns with our current stack. 
- **Agentic workflows** handle multi-step research (search -> crawl -> classify -> summarize) and allow retries/timeouts per source.

### Backend jobs
- **Manual-first orchestration**: All runs are triggered manually (UI buttons or CLI) to keep operators in the loop; no cron jobs. Each trigger enqueues one of two stages so we never block on missing data.
- **Workers**: Queue enrichment tasks (search, scraping, embeddings) and AI analysis tasks separately with backpressure.
- **Auditing**: Persist prompts/responses and data provenance in `intel_artifacts` with timestamps and source labels.

## 3) Concrete Code Changes (roadmap inside repo)
### Backend/API
1. **Two-stage orchestrator**: Add `backend/agentic_pipeline/staged_workflow.py` to expose Stage 1 (financial shortlist 150–180) and Stage 2 (manual AI screening to ~100). Stage triggers are invoked from UI or CLI without cron, and each run stores the filters/weights used.
2. **New service layer (FastAPI)** under `backend/api` exposing: `/filters/analytics`, `/companies/:id/intel`, `/companies/:id/ai-report`, `/search/vector`, `/jobs/enrich`. Implement financial percentile calculations and weighted scoring endpoints that wrap the existing `agentic_pipeline` scoring but accept dynamic weights.
3. **Background workers**: Add `backend/workers/` with RQ or Celery workers for enrichment and AI jobs. Provide enqueue helpers for manual invocations.
4. **Enrichment adapters**: In `backend/agentic_pipeline/web_enrichment.py`, extend to call SerpAPI/Perplexity, BuiltWith, LinkedIn, and scraper APIs; normalize outputs into `company_intel` rows and raw artifacts.
5. **Embedding pipeline**: Add `backend/agentic_pipeline/embeddings.py` to chunk/store site/news/review text into pgvector via Supabase SQL RPC.
6. **AI summarization**: Create `backend/agentic_pipeline/ai_reports.py` to generate business model summaries, weaknesses, uplift hypotheses, and outreach angles using structured prompts; persist to `ai_reports` and `playbooks` tables.
7. **Migrations**: Add SQL migrations under `database/migrations/` for new tables (`company_intel`, `intel_artifacts`, `ai_reports`, `playbooks`, `decision_log`, `company_embeddings`). Include indexes on `company_id`, `created_at`, and vector columns.

### Frontend
1. **Dashboard shell**: Replace `WorkingDashboard` with a layout that includes a command palette, adjustable sliders for financial weights, and tabs for Cohorts, Intelligence, AI Deep Dive, and Ranking. Use TanStack Query for live data from new endpoints. 
2. **Financial filter panel**: New component `FinancialFilterPanel` with sliders for weight/thresholds (revenue, growth, margins, headcount, leverage), percentile toggles, and cluster selection; updates query params and triggers live charts (scatter/density/quadrant). 
3. **Cohort visualizations**: Add `CohortCharts` to render scatter/quadrant and density maps from API analytics. 
4. **Intel timeline**: Component `CompanyIntelDrawer` showing enrichment artifacts (tech stack, hiring, SEO, ads, reviews) and domain detection results; supports refresh actions to enqueue jobs. 
5. **AI deep dive cards**: `AIDeepDivePanel` to stream summaries, weaknesses, uplift levers, impact ranges, playbook steps, and outreach angles; allow inline notes and overrides. 
6. **Ranking workspace**: `RankingTable` combining financial score, uplift score, strategic fit, manual override, and decision log entries with inline editing. 
7. **Vector search**: Add search box that queries `/search/vector` for semantic matches and surfaces context chips. 

### Data schema sketch
- `company_intel(company_id, domain, industry, product_taxonomy, customer_type, pricing, brand_positioning, digital_maturity, signals_json, source, captured_at)`
- `intel_artifacts(company_id, source, artifact_type, url, content, metadata, created_at)`
- `company_embeddings(company_id, chunk_id, embedding vector, content, source, created_at)`
- `ai_reports(company_id, business_model, weaknesses, uplift_ops, impact_range, outreach_angle, created_at)`
- `playbooks(company_id, hypothesis, actions, owner, status, expected_impact, created_at)`
- `decision_log(company_id, author, note, override_delta, fit_score, status, created_at)`

### 100-company target viability
- The SQLite mirror already covers 50k+ Nordic SMEs; the Stage 1 scorer can comfortably surface 150–180 companies that fit the thesis defaults (profitable growth, low leverage, stable headcount) without external data.
- Stage 2 runs can then prioritize the top 100 based on rapid AI screening scores, operator pins, and data quality gates; any enrichment misses can be backfilled by re-running Stage 1 with slightly relaxed thresholds.

### Phased roadmap
- **MVP**: Financial sliders + percentile filters, cohort charts, enrichment job trigger, and AI summary card reading from stored reports. 
- **v2**: Full intel drawer with tech stack/hiring/SEO signals, vector search, and composite ranking with overrides and decision log. 
- **v3**: Automated weekly refresh pipeline, multi-source retrieval with reranking, outreach angle generation, and integration with CRM/email triggers.
